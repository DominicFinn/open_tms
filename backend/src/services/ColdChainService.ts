import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

/** Default temperature ranges by order temperatureControl. */
const TEMP_DEFAULTS: Record<string, { min: number; max: number; alertMin: number; alertMax: number }> = {
  refrigerated: { min: 2, max: 8, alertMin: 3, alertMax: 7 },
  frozen: { min: -25, max: -18, alertMin: -23, alertMax: -20 },
};

export interface EffectiveRange {
  effectiveMinTemp: number | null;
  effectiveMaxTemp: number | null;
  effectiveAlertMinTemp: number | null;
  effectiveAlertMaxTemp: number | null;
}

export interface TemperatureReadingParams {
  orgId: string;
  shipmentId: string;
  deviceId?: string;
  orderId?: string;
  trackableUnitId?: string;
  temperature: number;
  lat?: number;
  lng?: number;
  recordedAt: Date;
  rawPayload?: any;
}

export interface TemperatureReadingResult {
  logId: string;
  isExcursion: boolean;
  isAlert: boolean;
  excursionId?: string;
}

export interface TemperatureSummary {
  totalReadings: number;
  minTemperature: number | null;
  maxTemperature: number | null;
  avgTemperature: number | null;
  excursionCount: number;
  alertCount: number;
  timeInRangePercent: number | null;
  firstReading: Date | null;
  lastReading: Date | null;
  monitoringDurationMinutes: number | null;
}

export class ColdChainService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Compute effective temperature range for a shipment from its orders.
   * Takes the widest bounds (lowest min, highest max) from all orders that
   * have temperature requirements (refrigerated or frozen).
   */
  async computeEffectiveRange(shipmentId: string): Promise<EffectiveRange> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        orderShipments: {
          include: { order: true },
        },
      },
    });

    if (!shipment) {
      throw new Error(`Shipment not found: ${shipmentId}`);
    }

    // Derive from linked orders' temperatureControl.
    let minTemp: number | null = null;
    let maxTemp: number | null = null;
    let alertMinTemp: number | null = null;
    let alertMaxTemp: number | null = null;
    let hasRequirements = false;

    for (const os of shipment.orderShipments) {
      const tc = os.order.temperatureControl;
      const defaults = TEMP_DEFAULTS[tc];
      if (!defaults) continue; // "ambient" or unknown — skip

      hasRequirements = true;

      // Widen bounds: take the lowest min and the highest max.
      minTemp = minTemp === null ? defaults.min : Math.min(minTemp, defaults.min);
      maxTemp = maxTemp === null ? defaults.max : Math.max(maxTemp, defaults.max);
      alertMinTemp = alertMinTemp === null ? defaults.alertMin : Math.min(alertMinTemp, defaults.alertMin);
      alertMaxTemp = alertMaxTemp === null ? defaults.alertMax : Math.max(alertMaxTemp, defaults.alertMax);
    }

    if (!hasRequirements) {
      return {
        effectiveMinTemp: null,
        effectiveMaxTemp: null,
        effectiveAlertMinTemp: null,
        effectiveAlertMaxTemp: null,
      };
    }

    return {
      effectiveMinTemp: minTemp,
      effectiveMaxTemp: maxTemp,
      effectiveAlertMinTemp: alertMinTemp,
      effectiveAlertMaxTemp: alertMaxTemp,
    };
  }

  /**
   * Update the shipment with computed effective temperature range.
   * Called when orders are added/removed.
   */
  async updateShipmentEffectiveRange(shipmentId: string): Promise<void> {
    const range = await this.computeEffectiveRange(shipmentId);

    const updateData: Record<string, any> = {
      effectiveMinTemp: range.effectiveMinTemp,
      effectiveMaxTemp: range.effectiveMaxTemp,
      effectiveAlertMinTemp: range.effectiveAlertMinTemp,
      effectiveAlertMaxTemp: range.effectiveAlertMaxTemp,
    };

    // If temperature thresholds are now set and disposition is still
    // "not_applicable", transition to "monitoring" automatically.
    if (range.effectiveMinTemp !== null || range.effectiveMaxTemp !== null) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { coldChainDisposition: true },
      });
      if (shipment && shipment.coldChainDisposition === 'not_applicable') {
        updateData.coldChainDisposition = 'monitoring';
      }
    }

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: updateData,
    });
  }

  /**
   * Process a temperature reading for cold chain monitoring.
   * Creates an ImmutableTemperatureLog entry and detects excursions.
   *
   * This is the core method called from the sensor ingestion pipeline.
   */
  async processTemperatureReading(params: TemperatureReadingParams): Promise<TemperatureReadingResult> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: params.shipmentId },
      select: {
        id: true,
        effectiveMinTemp: true,
        effectiveMaxTemp: true,
        effectiveAlertMinTemp: true,
        effectiveAlertMaxTemp: true,
      },
    });

    if (!shipment) {
      throw new Error(`Shipment not found: ${params.shipmentId}`);
    }

    const effMinTemp = shipment.effectiveMinTemp;
    const effMaxTemp = shipment.effectiveMaxTemp;
    const effAlertMinTemp = shipment.effectiveAlertMinTemp;
    const effAlertMaxTemp = shipment.effectiveAlertMaxTemp;

    // Determine compliance flags.
    const hasThresholds = effMinTemp !== null && effMaxTemp !== null;
    const hasAlertThresholds = effAlertMinTemp !== null && effAlertMaxTemp !== null;

    const isWithinRange = hasThresholds
      ? params.temperature >= effMinTemp! && params.temperature <= effMaxTemp!
      : true;

    const isWithinAlertRange = hasAlertThresholds
      ? params.temperature >= effAlertMinTemp! && params.temperature <= effAlertMaxTemp!
      : true;

    const isExcursion = hasThresholds && !isWithinRange;
    const isAlert = hasAlertThresholds && !isWithinAlertRange && isWithinRange;

    // Generate integrity hash.
    const integrityHash = this.generateIntegrityHash({
      shipmentId: params.shipmentId,
      deviceId: params.deviceId,
      temperature: params.temperature,
      recordedAt: params.recordedAt,
      effectiveMinTemp: effMinTemp ?? undefined,
      effectiveMaxTemp: effMaxTemp ?? undefined,
    });

    // Create the immutable log entry (WRITE-ONLY — never update or delete).
    const logId = randomUUID();
    await this.prisma.immutableTemperatureLog.create({
      data: {
        id: logId,
        orgId: params.orgId,
        shipmentId: params.shipmentId,
        deviceId: params.deviceId ?? null,
        orderId: params.orderId ?? null,
        trackableUnitId: params.trackableUnitId ?? null,
        temperature: params.temperature,
        lat: params.lat ?? null,
        lng: params.lng ?? null,
        recordedAt: params.recordedAt,
        effectiveMinTemp: effMinTemp,
        effectiveMaxTemp: effMaxTemp,
        effectiveAlertMinTemp: effAlertMinTemp,
        effectiveAlertMaxTemp: effAlertMaxTemp,
        isWithinRange,
        isWithinAlertRange,
        isExcursion,
        isAlert,
        integrityHash,
        rawPayload: params.rawPayload ?? undefined,
      },
    });

    // Handle excursion lifecycle.
    let excursionId: string | undefined;

    if (isExcursion || isAlert) {
      // Determine excursion type and severity.
      const excursionType = this.classifyExcursionType(
        params.temperature,
        effMinTemp,
        effMaxTemp,
        effAlertMinTemp,
        effAlertMaxTemp,
      );
      const severity = isExcursion ? 'critical' : 'warning';
      const thresholdValue = this.getBreachedThreshold(
        params.temperature,
        effMinTemp,
        effMaxTemp,
        effAlertMinTemp,
        effAlertMaxTemp,
      );

      // Look for an existing active excursion for this device+shipment+type.
      const activeExcursion = await this.prisma.coldChainExcursion.findFirst({
        where: {
          shipmentId: params.shipmentId,
          deviceId: params.deviceId ?? null,
          excursionType,
          status: 'active',
          endedAt: null,
        },
        orderBy: { startedAt: 'desc' },
      });

      if (activeExcursion) {
        // Update existing excursion: bump reading count and peak value.
        const newPeak = this.isMoreSevere(params.temperature, activeExcursion.peakValue, excursionType)
          ? params.temperature
          : activeExcursion.peakValue;

        await this.prisma.coldChainExcursion.update({
          where: { id: activeExcursion.id },
          data: {
            readingCount: activeExcursion.readingCount + 1,
            peakValue: newPeak,
            severity: isExcursion ? 'critical' : activeExcursion.severity,
          },
        });
        excursionId = activeExcursion.id;
      } else {
        // Create a new excursion.
        excursionId = randomUUID();
        await this.prisma.coldChainExcursion.create({
          data: {
            id: excursionId,
            orgId: params.orgId,
            shipmentId: params.shipmentId,
            deviceId: params.deviceId ?? null,
            excursionType,
            severity,
            startedAt: params.recordedAt,
            peakValue: params.temperature,
            thresholdValue,
            readingCount: 1,
          },
        });
      }
    } else {
      // Reading is in range — close any active excursions for this device+shipment.
      const activeExcursions = await this.prisma.coldChainExcursion.findMany({
        where: {
          shipmentId: params.shipmentId,
          deviceId: params.deviceId ?? null,
          status: 'active',
          endedAt: null,
        },
      });

      for (const excursion of activeExcursions) {
        const durationMs = params.recordedAt.getTime() - excursion.startedAt.getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        await this.prisma.coldChainExcursion.update({
          where: { id: excursion.id },
          data: {
            endedAt: params.recordedAt,
            durationMinutes,
          },
        });
      }
    }

    return {
      logId,
      isExcursion,
      isAlert,
      excursionId,
    };
  }

  /**
   * Generate SHA-256 integrity hash for a temperature log entry.
   * Used for CFR 21 Part 11 tamper evidence.
   */
  generateIntegrityHash(params: {
    shipmentId?: string;
    deviceId?: string;
    temperature: number;
    recordedAt: Date;
    effectiveMinTemp?: number;
    effectiveMaxTemp?: number;
  }): string {
    const data = [
      params.shipmentId ?? '',
      params.deviceId ?? '',
      params.temperature.toFixed(4),
      params.recordedAt.toISOString(),
      params.effectiveMinTemp?.toFixed(4) ?? '',
      params.effectiveMaxTemp?.toFixed(4) ?? '',
    ].join('|');
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get temperature summary for a shipment (for compliance reports).
   */
  async getTemperatureSummary(shipmentId: string): Promise<TemperatureSummary> {
    const aggregates = await this.prisma.immutableTemperatureLog.aggregate({
      where: { shipmentId },
      _count: { id: true },
      _min: { temperature: true, recordedAt: true },
      _max: { temperature: true, recordedAt: true },
      _avg: { temperature: true },
    });

    const totalReadings = aggregates._count.id;

    if (totalReadings === 0) {
      return {
        totalReadings: 0,
        minTemperature: null,
        maxTemperature: null,
        avgTemperature: null,
        excursionCount: 0,
        alertCount: 0,
        timeInRangePercent: null,
        firstReading: null,
        lastReading: null,
        monitoringDurationMinutes: null,
      };
    }

    const excursionCount = await this.prisma.immutableTemperatureLog.count({
      where: { shipmentId, isExcursion: true },
    });

    const alertCount = await this.prisma.immutableTemperatureLog.count({
      where: { shipmentId, isAlert: true },
    });

    const inRangeCount = await this.prisma.immutableTemperatureLog.count({
      where: { shipmentId, isWithinRange: true },
    });

    const firstReading = aggregates._min.recordedAt;
    const lastReading = aggregates._max.recordedAt;

    let monitoringDurationMinutes: number | null = null;
    if (firstReading && lastReading) {
      const durationMs = lastReading.getTime() - firstReading.getTime();
      monitoringDurationMinutes = Math.round(durationMs / 60000);
    }

    const timeInRangePercent = totalReadings > 0
      ? Math.round((inRangeCount / totalReadings) * 10000) / 100
      : null;

    const avgTemp = aggregates._avg.temperature;

    return {
      totalReadings,
      minTemperature: aggregates._min.temperature,
      maxTemperature: aggregates._max.temperature,
      avgTemperature: avgTemp !== null ? Math.round(avgTemp * 100) / 100 : null,
      excursionCount,
      alertCount,
      timeInRangePercent,
      firstReading,
      lastReading,
      monitoringDurationMinutes,
    };
  }

  // ────────────────────── Private helpers ──────────────────────

  /**
   * Classify the type of excursion based on which threshold was breached.
   */
  private classifyExcursionType(
    temperature: number,
    minTemp: number | null,
    maxTemp: number | null,
    alertMinTemp: number | null,
    alertMaxTemp: number | null,
  ): string {
    if (maxTemp !== null && temperature > maxTemp) return 'high_temp';
    if (minTemp !== null && temperature < minTemp) return 'low_temp';
    if (alertMaxTemp !== null && temperature > alertMaxTemp) return 'high_temp';
    if (alertMinTemp !== null && temperature < alertMinTemp) return 'low_temp';
    return 'high_temp'; // fallback
  }

  /**
   * Return the threshold value that was breached.
   */
  private getBreachedThreshold(
    temperature: number,
    minTemp: number | null,
    maxTemp: number | null,
    alertMinTemp: number | null,
    alertMaxTemp: number | null,
  ): number {
    if (maxTemp !== null && temperature > maxTemp) return maxTemp;
    if (minTemp !== null && temperature < minTemp) return minTemp;
    if (alertMaxTemp !== null && temperature > alertMaxTemp) return alertMaxTemp;
    if (alertMinTemp !== null && temperature < alertMinTemp) return alertMinTemp;
    return 0;
  }

  /**
   * Determine whether a new reading is more severe than the current peak.
   * For high_temp excursions, higher is worse. For low_temp, lower is worse.
   */
  private isMoreSevere(newValue: number, currentPeak: number, excursionType: string): boolean {
    if (excursionType === 'low_temp') return newValue < currentPeak;
    return newValue > currentPeak; // high_temp (or any other)
  }
}
