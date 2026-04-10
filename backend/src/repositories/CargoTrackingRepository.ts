import { PrismaClient, CargoScan, CargoDiscrepancy } from '@prisma/client';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateCargoScanDTO {
  trackableUnitId: string;
  shipmentStopId: string;
  shipmentId: string;
  scanType: 'load' | 'unload' | 'checkpoint';
  scanMethod: 'barcode' | 'rfid' | 'manual' | 'geofence' | 'iot';
  scannedBy?: string;
  lat?: number;
  lng?: number;
  expected?: boolean;
  notes?: string;
}

export interface CreateCargoDiscrepancyDTO {
  shipmentId: string;
  trackableUnitId: string;
  discrepancyType: 'misdrop_early' | 'misdrop_late' | 'missing_at_stop' | 'unexpected_at_stop' | 'left_on_vehicle' | 'damaged' | 'wrong_destination';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  expectedStopId?: string;
  actualStopId?: string;
  detectedBy?: string;
  description: string;
  notes?: string;
}

export interface UpdateCargoDiscrepancyDTO {
  status?: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolution?: string;
  notes?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ICargoTrackingRepository {
  // Cargo Scans
  createScan(data: CreateCargoScanDTO): Promise<CargoScan>;
  findScansByShipment(shipmentId: string): Promise<CargoScan[]>;
  findScansByStop(shipmentStopId: string): Promise<CargoScan[]>;
  findScansByUnit(trackableUnitId: string): Promise<CargoScan[]>;

  // Cargo Discrepancies
  createDiscrepancy(data: CreateCargoDiscrepancyDTO): Promise<CargoDiscrepancy>;
  findDiscrepanciesByShipment(shipmentId: string): Promise<CargoDiscrepancy[]>;
  findOpenDiscrepancies(): Promise<CargoDiscrepancy[]>;
  findDiscrepancyById(id: string): Promise<CargoDiscrepancy | null>;
  updateDiscrepancy(id: string, data: UpdateCargoDiscrepancyDTO): Promise<CargoDiscrepancy>;

  // Cargo Manifest — expected vs actual at each stop
  getCargoManifest(shipmentId: string): Promise<CargoManifestResult>;

  // Update trackable unit location
  updateUnitLocation(trackableUnitId: string, currentStopId: string | null, condition?: string): Promise<void>;
}

export interface CargoManifestStop {
  stopId: string;
  sequenceNumber: number;
  locationName: string;
  stopType: string;
  status: string;
  expectedUnits: ManifestUnit[];
  scannedUnits: ManifestUnit[];
  discrepancies: CargoDiscrepancy[];
}

export interface ManifestUnit {
  id: string;
  identifier: string;
  unitType: string;
  barcode: string | null;
  condition: string;
  currentStopId: string | null;
  orderId: string;
  orderNumber: string;
  lineItemCount: number;
  lastScannedAt: Date | null;
}

export interface CargoManifestResult {
  shipmentId: string;
  stops: CargoManifestStop[];
  unassignedUnits: ManifestUnit[];
  totalExpected: number;
  totalScanned: number;
  totalDiscrepancies: number;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class CargoTrackingRepository implements ICargoTrackingRepository {
  constructor(private prisma: PrismaClient) {}

  async createScan(data: CreateCargoScanDTO): Promise<CargoScan> {
    // Also update the trackable unit's last scanned time
    await this.prisma.trackableUnit.update({
      where: { id: data.trackableUnitId },
      data: { lastScannedAt: new Date() },
    });

    return this.prisma.cargoScan.create({ data });
  }

  async findScansByShipment(shipmentId: string): Promise<CargoScan[]> {
    return this.prisma.cargoScan.findMany({
      where: { shipmentId },
      orderBy: { scannedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
        shipmentStop: { include: { location: true } },
      },
    });
  }

  async findScansByStop(shipmentStopId: string): Promise<CargoScan[]> {
    return this.prisma.cargoScan.findMany({
      where: { shipmentStopId },
      orderBy: { scannedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
      },
    });
  }

  async findScansByUnit(trackableUnitId: string): Promise<CargoScan[]> {
    return this.prisma.cargoScan.findMany({
      where: { trackableUnitId },
      orderBy: { scannedAt: 'desc' },
      include: {
        shipmentStop: { include: { location: true } },
      },
    });
  }

  async createDiscrepancy(data: CreateCargoDiscrepancyDTO): Promise<CargoDiscrepancy> {
    return this.prisma.cargoDiscrepancy.create({
      data,
      include: {
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async findDiscrepanciesByShipment(shipmentId: string): Promise<CargoDiscrepancy[]> {
    return this.prisma.cargoDiscrepancy.findMany({
      where: { shipmentId },
      orderBy: { detectedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async findOpenDiscrepancies(): Promise<CargoDiscrepancy[]> {
    return this.prisma.cargoDiscrepancy.findMany({
      where: { status: { in: ['open', 'investigating'] } },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      include: {
        shipment: true,
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async findDiscrepancyById(id: string): Promise<CargoDiscrepancy | null> {
    return this.prisma.cargoDiscrepancy.findUnique({
      where: { id },
      include: {
        shipment: true,
        trackableUnit: { include: { order: true, lineItems: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async updateDiscrepancy(id: string, data: UpdateCargoDiscrepancyDTO): Promise<CargoDiscrepancy> {
    const updateData: any = { ...data };
    if (data.status === 'resolved') {
      updateData.resolvedAt = new Date();
    }
    return this.prisma.cargoDiscrepancy.update({
      where: { id },
      data: updateData,
      include: {
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async updateUnitLocation(trackableUnitId: string, currentStopId: string | null, condition?: string): Promise<void> {
    const data: any = { currentStopId };
    if (condition) data.condition = condition;
    await this.prisma.trackableUnit.update({
      where: { id: trackableUnitId },
      data,
    });
  }

  async getCargoManifest(shipmentId: string): Promise<CargoManifestResult> {
    // Get all stops for the shipment with their expected orders and trackable units
    const stops = await this.prisma.shipmentStop.findMany({
      where: { shipmentId },
      orderBy: { sequenceNumber: 'asc' },
      include: {
        location: true,
        orders: {
          include: {
            trackableUnits: {
              include: { lineItems: true },
            },
          },
        },
        cargoScans: {
          include: {
            trackableUnit: {
              include: { order: true, lineItems: true },
            },
          },
        },
        discrepanciesExpected: {
          include: {
            trackableUnit: { include: { order: true } },
            actualStop: { include: { location: true } },
          },
        },
      },
    });

    // Get all orders for this shipment (including those not assigned to stops)
    const orderShipments = await this.prisma.orderShipment.findMany({
      where: { shipmentId },
      include: {
        order: {
          include: {
            trackableUnits: { include: { lineItems: true } },
          },
        },
      },
    });

    let totalExpected = 0;
    let totalScanned = 0;
    let totalDiscrepancies = 0;

    const manifestStops: CargoManifestStop[] = stops.map((stop) => {
      // Expected units: trackable units from orders assigned to this stop
      const expectedUnits: ManifestUnit[] = [];
      for (const order of stop.orders) {
        for (const unit of order.trackableUnits) {
          expectedUnits.push({
            id: unit.id,
            identifier: unit.identifier,
            unitType: unit.unitType,
            barcode: unit.barcode,
            condition: (unit as any).condition || 'good',
            currentStopId: (unit as any).currentStopId || null,
            orderId: order.id,
            orderNumber: order.orderNumber,
            lineItemCount: unit.lineItems.length,
            lastScannedAt: (unit as any).lastScannedAt || null,
          });
        }
      }

      // Scanned units: from cargo scans at this stop (unload type)
      const scannedUnitIds = new Set<string>();
      const scannedUnits: ManifestUnit[] = [];
      for (const scan of stop.cargoScans.filter((s) => s.scanType === 'unload')) {
        if (!scannedUnitIds.has(scan.trackableUnitId)) {
          scannedUnitIds.add(scan.trackableUnitId);
          const unit = scan.trackableUnit;
          scannedUnits.push({
            id: unit.id,
            identifier: unit.identifier,
            unitType: unit.unitType,
            barcode: unit.barcode,
            condition: (unit as any).condition || 'good',
            currentStopId: (unit as any).currentStopId || null,
            orderId: unit.orderId,
            orderNumber: (unit as any).order?.orderNumber || '',
            lineItemCount: unit.lineItems?.length || 0,
            lastScannedAt: (unit as any).lastScannedAt || null,
          });
        }
      }

      totalExpected += expectedUnits.length;
      totalScanned += scannedUnits.length;
      totalDiscrepancies += stop.discrepanciesExpected.length;

      return {
        stopId: stop.id,
        sequenceNumber: stop.sequenceNumber,
        locationName: stop.location.name,
        stopType: stop.stopType,
        status: stop.status,
        expectedUnits,
        scannedUnits,
        discrepancies: stop.discrepanciesExpected as any,
      };
    });

    // Find trackable units not assigned to any stop
    const assignedUnitIds = new Set<string>();
    for (const stop of manifestStops) {
      for (const unit of stop.expectedUnits) {
        assignedUnitIds.add(unit.id);
      }
    }

    const unassignedUnits: ManifestUnit[] = [];
    for (const os of orderShipments) {
      for (const unit of os.order.trackableUnits) {
        if (!assignedUnitIds.has(unit.id)) {
          unassignedUnits.push({
            id: unit.id,
            identifier: unit.identifier,
            unitType: unit.unitType,
            barcode: unit.barcode,
            condition: (unit as any).condition || 'good',
            currentStopId: (unit as any).currentStopId || null,
            orderId: os.order.id,
            orderNumber: os.order.orderNumber,
            lineItemCount: unit.lineItems.length,
            lastScannedAt: (unit as any).lastScannedAt || null,
          });
        }
      }
    }

    return {
      shipmentId,
      stops: manifestStops,
      unassignedUnits,
      totalExpected,
      totalScanned,
      totalDiscrepancies,
    };
  }
}
