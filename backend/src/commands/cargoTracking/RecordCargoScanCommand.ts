import { PrismaClient, CargoScan, CargoDiscrepancy } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { CargoScopeError, DiscrepancyType, findStopWithExpectedUnits, setUnitLocation } from './cargoReconciliation.js';

export interface RecordCargoScanPayload {
  shipmentId: string;
  shipmentStopId: string;
  trackableUnitId: string;
  scanType: 'load' | 'unload' | 'checkpoint';
  scanMethod: 'barcode' | 'rfid' | 'manual' | 'geofence' | 'iot';
  scannedBy?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

export interface RecordCargoScanResult {
  scan: CargoScan;
  isExpected: boolean;
  discrepancy: CargoDiscrepancy | null;
}

export const RECORD_CARGO_SCAN = 'cargo.record_scan';

async function findUnitInOrg(tx: TransactionClient, orgId: string, trackableUnitId: string) {
  const unit = await tx.trackableUnit.findFirst({
    where: { id: trackableUnitId, order: { orgId } },
    include: { order: { include: { deliveryStop: { include: { location: true } } } } },
  });
  if (!unit) throw new CargoScopeError('Trackable unit not found');
  return unit;
}

type Stop = Awaited<ReturnType<typeof findStopWithExpectedUnits>>;
type Unit = Awaited<ReturnType<typeof findUnitInOrg>>;

export class RecordCargoScanCommandHandler extends BaseCommandHandler<RecordCargoScanPayload, RecordCargoScanResult> {
  readonly commandType = RECORD_CARGO_SCAN;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordCargoScanPayload>, tx: TransactionClient, emit: EmitFn) {
    const { orgId, payload } = command;
    const stop = await findStopWithExpectedUnits(tx, orgId, payload.shipmentStopId);
    if (stop.shipmentId !== payload.shipmentId) throw new CargoScopeError('Shipment stop not found');

    const unit = await findUnitInOrg(tx, orgId, payload.trackableUnitId);

    const isExpected = stop.orders.some((o) => o.trackableUnits.some((tu) => tu.id === unit.id));

    await tx.trackableUnit.update({ where: { id: unit.id, order: { orgId } }, data: { lastScannedAt: new Date() } });
    const scan = await tx.cargoScan.create({ data: { ...payload, orgId, expected: isExpected } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARGO_SCAN_RECORDED,
      entityType: 'cargo_scan',
      entityId: scan.id,
      payload: {
        shipmentId: payload.shipmentId,
        trackableUnitId: payload.trackableUnitId,
        scanType: payload.scanType,
        stopId: payload.shipmentStopId,
      },
    }));

    let discrepancy: CargoDiscrepancy | null = null;
    if (payload.scanType === 'unload') {
      if (!isExpected) discrepancy = await this.recordMisdrop(command, tx, emit, stop, unit);
      await setUnitLocation(tx, orgId, unit.id, stop.id);
    }

    return { scan, isExpected, discrepancy };
  }

  // BUSINESS RULE: an unload at a stop the unit wasn't bound for is a misdrop. Early or late is
  // judged against the unit's own delivery stop; with no delivery stop it's a wrong destination.
  private async recordMisdrop(
    command: Command<RecordCargoScanPayload>,
    tx: TransactionClient,
    emit: EmitFn,
    stop: Stop,
    unit: Unit,
  ): Promise<CargoDiscrepancy> {
    const { orgId, payload } = command;
    const expectedStop = unit.order.deliveryStop;
    let discrepancyType: DiscrepancyType = 'wrong_destination';
    if (expectedStop) {
      discrepancyType = stop.sequenceNumber < expectedStop.sequenceNumber ? 'misdrop_early' : 'misdrop_late';
    }

    const expectedLocationName = expectedStop?.location?.name || 'unknown';
    const actualLocationName = stop.location?.name || 'unknown';

    const discrepancy = await tx.cargoDiscrepancy.create({
      data: {
        orgId,
        shipmentId: payload.shipmentId,
        trackableUnitId: unit.id,
        discrepancyType,
        severity: 'high',
        expectedStopId: unit.order.deliveryStopId || undefined,
        actualStopId: stop.id,
        detectedBy: payload.scannedBy || 'system',
        description: `${unit.unitType} "${unit.identifier}" unloaded at ${actualLocationName} but was expected at ${expectedLocationName}`,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARGO_MISDROP_DETECTED,
      entityType: 'trackable_unit',
      entityId: unit.id,
      payload: {
        shipmentId: payload.shipmentId,
        trackableUnitId: unit.id,
        unitIdentifier: unit.identifier,
        unitType: unit.unitType,
        discrepancyType,
        expectedStop: expectedLocationName,
        actualStop: actualLocationName,
        orderId: unit.orderId,
        orderNumber: unit.order.orderNumber,
      },
    }));

    return discrepancy;
  }
}
