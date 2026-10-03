import { PrismaClient, CargoScan, CargoDiscrepancy } from '@prisma/client';

// ─── Interface ────────────────────────────────────────────────────────────────

// Writes go through the cargo tracking command handlers. Every read here takes the caller's orgId,
// so an id from another tenant reads as not found.
export interface ICargoTrackingRepository {
  // Scope lookups, used by routes to turn a cross-tenant id into a 404 before dispatching
  findShipmentInOrg(orgId: string, shipmentId: string): Promise<{ id: string } | null>;
  findStopInOrg(orgId: string, shipmentStopId: string): Promise<{ id: string; shipmentId: string } | null>;

  // Cargo Scans
  findScansByShipment(orgId: string, shipmentId: string): Promise<CargoScan[]>;
  findScansByStop(orgId: string, shipmentStopId: string): Promise<CargoScan[]>;

  // Cargo Discrepancies
  findDiscrepanciesByShipment(orgId: string, shipmentId: string): Promise<CargoDiscrepancy[]>;
  findOpenDiscrepancies(orgId: string): Promise<CargoDiscrepancy[]>;
  findDiscrepancyById(orgId: string, id: string): Promise<CargoDiscrepancy | null>;

  // Cargo Manifest: expected vs actual at each stop. Null when the shipment isn't in the org.
  getCargoManifest(orgId: string, shipmentId: string): Promise<CargoManifestResult | null>;
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

  async findShipmentInOrg(orgId: string, shipmentId: string): Promise<{ id: string } | null> {
    return this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId }, select: { id: true } });
  }

  async findStopInOrg(orgId: string, shipmentStopId: string): Promise<{ id: string; shipmentId: string } | null> {
    return this.prisma.shipmentStop.findFirst({
      where: { id: shipmentStopId, shipment: { orgId } },
      select: { id: true, shipmentId: true },
    });
  }

  async findScansByShipment(orgId: string, shipmentId: string): Promise<CargoScan[]> {
    return this.prisma.cargoScan.findMany({
      where: { orgId, shipmentId },
      orderBy: { scannedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
        shipmentStop: { include: { location: true } },
      },
    });
  }

  async findScansByStop(orgId: string, shipmentStopId: string): Promise<CargoScan[]> {
    return this.prisma.cargoScan.findMany({
      where: { orgId, shipmentStopId },
      orderBy: { scannedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
      },
    });
  }

  async findDiscrepanciesByShipment(orgId: string, shipmentId: string): Promise<CargoDiscrepancy[]> {
    return this.prisma.cargoDiscrepancy.findMany({
      where: { orgId, shipmentId },
      orderBy: { detectedAt: 'desc' },
      include: {
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async findOpenDiscrepancies(orgId: string): Promise<CargoDiscrepancy[]> {
    return this.prisma.cargoDiscrepancy.findMany({
      where: { orgId, status: { in: ['open', 'investigating'] } },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      include: {
        shipment: true,
        trackableUnit: { include: { order: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async findDiscrepancyById(orgId: string, id: string): Promise<CargoDiscrepancy | null> {
    return this.prisma.cargoDiscrepancy.findFirst({
      where: { id, orgId },
      include: {
        shipment: true,
        trackableUnit: { include: { order: true, lineItems: true } },
        expectedStop: { include: { location: true } },
        actualStop: { include: { location: true } },
      },
    });
  }

  async getCargoManifest(orgId: string, shipmentId: string): Promise<CargoManifestResult | null> {
    const shipment = await this.findShipmentInOrg(orgId, shipmentId);
    if (!shipment) return null;

    // Get all stops for the shipment with their expected orders and trackable units
    const stops = await this.prisma.shipmentStop.findMany({
      where: { shipmentId, shipment: { orgId } },
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
          where: { orgId },
          include: {
            trackableUnit: {
              include: { order: true, lineItems: true },
            },
          },
        },
        discrepanciesExpected: {
          where: { orgId },
          include: {
            trackableUnit: { include: { order: true } },
            actualStop: { include: { location: true } },
          },
        },
      },
    });

    // Get all orders for this shipment (including those not assigned to stops)
    const orderShipments = await this.prisma.orderShipment.findMany({
      where: { shipmentId, order: { orgId } },
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
