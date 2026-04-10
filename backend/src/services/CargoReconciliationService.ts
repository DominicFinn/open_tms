import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ICargoTrackingRepository,
  CreateCargoScanDTO,
  CreateCargoDiscrepancyDTO,
} from '../repositories/CargoTrackingRepository.js';
import { IEventBus } from '../events/IEventBus.js';
import { DomainEvent } from '../events/DomainEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

export interface ICargoReconciliationService {
  /**
   * Record a cargo scan (load/unload/checkpoint) at a stop and evaluate for discrepancies.
   */
  recordCargoScan(scan: CreateCargoScanDTO): Promise<CargoScanResult>;

  /**
   * Reconcile cargo when a stop is completed.
   * Compares expected units (from orders assigned to this stop) against scanned units.
   * Creates discrepancies for missing or unexpected cargo.
   */
  reconcileStopCompletion(shipmentStopId: string): Promise<ReconciliationResult>;

  /**
   * Check for cargo left on vehicle after last stop is completed.
   */
  checkLeftOnVehicle(shipmentId: string): Promise<ReconciliationResult>;

  /**
   * Auto-mark trackable units as delivered at a stop when the stop is completed
   * and no explicit scans exist (bulk operation for geofence/auto arrivals).
   */
  autoReconcileStop(shipmentStopId: string, method: string): Promise<number>;
}

export interface CargoScanResult {
  scan: any;
  isExpected: boolean;
  discrepancy: any | null;
}

export interface ReconciliationResult {
  stopId?: string;
  shipmentId: string;
  missingUnits: string[];
  unexpectedUnits: string[];
  leftOnVehicle: string[];
  discrepanciesCreated: number;
}

export class CargoReconciliationService implements ICargoReconciliationService {
  constructor(
    private prisma: PrismaClient,
    private cargoRepo: ICargoTrackingRepository,
    private eventBus: IEventBus,
  ) {}

  async recordCargoScan(scanData: CreateCargoScanDTO): Promise<CargoScanResult> {
    // Find the stop to determine if this unit is expected here
    const stop = await this.prisma.shipmentStop.findUnique({
      where: { id: scanData.shipmentStopId },
      include: {
        location: true,
        orders: {
          include: { trackableUnits: true },
        },
      },
    });

    if (!stop) {
      throw new Error('Shipment stop not found');
    }

    // Get the trackable unit
    const unit = await this.prisma.trackableUnit.findUnique({
      where: { id: scanData.trackableUnitId },
      include: {
        order: {
          include: { deliveryStop: { include: { location: true } } },
        },
      },
    });

    if (!unit) {
      throw new Error('Trackable unit not found');
    }

    // Determine if this unit is expected at this stop
    const expectedUnitIds = new Set<string>();
    for (const order of stop.orders) {
      for (const tu of order.trackableUnits) {
        expectedUnitIds.add(tu.id);
      }
    }
    const isExpected = expectedUnitIds.has(scanData.trackableUnitId);

    // Create the scan record
    const scan = await this.cargoRepo.createScan({
      ...scanData,
      expected: isExpected,
    });

    let discrepancy: any = null;

    // If this is an unload scan and the unit is NOT expected here, create a discrepancy
    if (scanData.scanType === 'unload' && !isExpected) {
      const expectedStopId = unit.order.deliveryStopId;
      const expectedStop = unit.order.deliveryStop;

      // Determine discrepancy type
      let discrepancyType: CreateCargoDiscrepancyDTO['discrepancyType'];
      if (expectedStopId) {
        // Check if this stop comes before or after the expected stop
        const expectedStopRecord = await this.prisma.shipmentStop.findUnique({
          where: { id: expectedStopId },
        });
        if (expectedStopRecord && stop.sequenceNumber < expectedStopRecord.sequenceNumber) {
          discrepancyType = 'misdrop_early';
        } else {
          discrepancyType = 'misdrop_late';
        }
      } else {
        discrepancyType = 'wrong_destination';
      }

      const expectedLocationName = expectedStop?.location?.name || 'unknown';
      const actualLocationName = stop.location?.name || 'unknown';

      discrepancy = await this.cargoRepo.createDiscrepancy({
        shipmentId: scanData.shipmentId,
        trackableUnitId: scanData.trackableUnitId,
        discrepancyType,
        severity: 'high',
        expectedStopId: expectedStopId || undefined,
        actualStopId: scanData.shipmentStopId,
        detectedBy: scanData.scannedBy || 'system',
        description: `${unit.unitType} "${unit.identifier}" unloaded at ${actualLocationName} but was expected at ${expectedLocationName}`,
      });

      // Publish event for misdrop
      await this.publishCargoEvent(
        EVENT_TYPES.CARGO_MISDROP_DETECTED,
        scanData.shipmentId,
        scanData.trackableUnitId,
        {
          unitIdentifier: unit.identifier,
          unitType: unit.unitType,
          discrepancyType,
          expectedStop: expectedLocationName,
          actualStop: actualLocationName,
          orderId: unit.orderId,
          orderNumber: unit.order.orderNumber,
        },
      );
    }

    // Update unit location if unloading
    if (scanData.scanType === 'unload') {
      await this.cargoRepo.updateUnitLocation(scanData.trackableUnitId, scanData.shipmentStopId);
    }

    return { scan, isExpected, discrepancy };
  }

  async reconcileStopCompletion(shipmentStopId: string): Promise<ReconciliationResult> {
    const stop = await this.prisma.shipmentStop.findUnique({
      where: { id: shipmentStopId },
      include: {
        location: true,
        shipment: true,
        orders: {
          include: {
            trackableUnits: true,
          },
        },
        cargoScans: {
          where: { scanType: 'unload' },
        },
      },
    });

    if (!stop) {
      throw new Error('Shipment stop not found');
    }

    const result: ReconciliationResult = {
      stopId: shipmentStopId,
      shipmentId: stop.shipmentId,
      missingUnits: [],
      unexpectedUnits: [],
      leftOnVehicle: [],
      discrepanciesCreated: 0,
    };

    // Expected unit IDs at this stop (from assigned orders)
    const expectedUnitIds = new Set<string>();
    const unitMap = new Map<string, any>();
    for (const order of stop.orders) {
      for (const unit of order.trackableUnits) {
        expectedUnitIds.add(unit.id);
        unitMap.set(unit.id, { ...unit, orderNumber: order.orderNumber });
      }
    }

    // Scanned unit IDs at this stop
    const scannedUnitIds = new Set(stop.cargoScans.map((s) => s.trackableUnitId));

    // If no scans were recorded but the stop has been completed, auto-mark units as delivered
    // (This happens for geofence/auto completions where no manual scanning occurs)
    if (scannedUnitIds.size === 0 && expectedUnitIds.size > 0) {
      // In auto mode, assume all expected units were delivered correctly
      for (const unitId of expectedUnitIds) {
        await this.cargoRepo.updateUnitLocation(unitId, shipmentStopId);
      }
      return result;
    }

    // Find units expected but NOT scanned (missing)
    for (const unitId of expectedUnitIds) {
      if (!scannedUnitIds.has(unitId)) {
        result.missingUnits.push(unitId);
        const unit = unitMap.get(unitId);

        const disc = await this.cargoRepo.createDiscrepancy({
          shipmentId: stop.shipmentId,
          trackableUnitId: unitId,
          discrepancyType: 'missing_at_stop',
          severity: 'high',
          expectedStopId: shipmentStopId,
          detectedBy: 'system',
          description: `${unit?.unitType || 'Unit'} "${unit?.identifier || unitId}" expected at ${stop.location.name} but was not scanned on unload`,
        });
        result.discrepanciesCreated++;

        await this.publishCargoEvent(
          EVENT_TYPES.CARGO_MISSING_AT_STOP,
          stop.shipmentId,
          unitId,
          {
            unitIdentifier: unit?.identifier,
            unitType: unit?.unitType,
            stopName: stop.location.name,
            orderNumber: unit?.orderNumber,
          },
        );
      }
    }

    // Find units scanned but NOT expected (unexpected deliveries / misdrops from elsewhere)
    for (const scanUnitId of scannedUnitIds) {
      if (!expectedUnitIds.has(scanUnitId)) {
        result.unexpectedUnits.push(scanUnitId);
        // Discrepancy already created during the scan itself (in recordCargoScan)
      }
    }

    return result;
  }

  async checkLeftOnVehicle(shipmentId: string): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      shipmentId,
      missingUnits: [],
      unexpectedUnits: [],
      leftOnVehicle: [],
      discrepanciesCreated: 0,
    };

    // Get all stops and all trackable units for this shipment
    const stops = await this.prisma.shipmentStop.findMany({
      where: { shipmentId },
      orderBy: { sequenceNumber: 'asc' },
    });

    const allCompleted = stops.every((s) => s.status === 'completed' || s.status === 'skipped');
    if (!allCompleted) {
      return result; // Not all stops done yet
    }

    // Get all orders for this shipment with their trackable units
    const orderShipments = await this.prisma.orderShipment.findMany({
      where: { shipmentId },
      include: {
        order: {
          include: {
            trackableUnits: true,
          },
        },
      },
    });

    for (const os of orderShipments) {
      for (const unit of os.order.trackableUnits) {
        // If unit has no current stop, it's still "on the vehicle"
        if (!(unit as any).currentStopId) {
          result.leftOnVehicle.push(unit.id);

          await this.cargoRepo.createDiscrepancy({
            shipmentId,
            trackableUnitId: unit.id,
            discrepancyType: 'left_on_vehicle',
            severity: 'critical',
            expectedStopId: os.order.deliveryStopId || undefined,
            detectedBy: 'system',
            description: `${unit.unitType} "${unit.identifier}" was never confirmed delivered — may still be on the vehicle`,
          });
          result.discrepanciesCreated++;

          await this.publishCargoEvent(
            EVENT_TYPES.CARGO_LEFT_ON_VEHICLE,
            shipmentId,
            unit.id,
            {
              unitIdentifier: unit.identifier,
              unitType: unit.unitType,
              orderId: unit.orderId,
              orderNumber: os.order.orderNumber,
            },
          );
        }
      }
    }

    return result;
  }

  async autoReconcileStop(shipmentStopId: string, method: string): Promise<number> {
    const stop = await this.prisma.shipmentStop.findUnique({
      where: { id: shipmentStopId },
      include: {
        shipment: true,
        location: true,
        orders: {
          include: { trackableUnits: true },
        },
      },
    });

    if (!stop) return 0;

    let count = 0;
    for (const order of stop.orders) {
      for (const unit of order.trackableUnits) {
        // Mark unit as being at this stop
        await this.cargoRepo.updateUnitLocation(unit.id, shipmentStopId);

        // Create an automatic scan record
        await this.cargoRepo.createScan({
          trackableUnitId: unit.id,
          shipmentStopId,
          shipmentId: stop.shipmentId,
          scanType: 'unload',
          scanMethod: method === 'geofence_iot' ? 'iot' : method === 'geofence' ? 'geofence' : 'manual',
          scannedBy: `system:${method}`,
          expected: true,
        });
        count++;
      }
    }

    return count;
  }

  private async publishCargoEvent(
    eventType: string,
    shipmentId: string,
    trackableUnitId: string,
    payload: any,
  ): Promise<void> {
    const event: DomainEvent = {
      id: randomUUID(),
      type: eventType,
      timestamp: new Date().toISOString(),
      orgId: 'default',
      actorId: null,
      entityType: 'trackable_unit',
      entityId: trackableUnitId,
      payload: {
        ...payload,
        shipmentId,
        trackableUnitId,
      },
      metadata: {
        correlationId: randomUUID(),
        source: 'system',
        schemaVersion: 1,
      },
    };

    try {
      await this.eventBus.publish(event);
    } catch (err) {
      // Log but don't fail the scan — event publishing is best-effort
      console.error('Failed to publish cargo event:', err);
    }
  }
}
