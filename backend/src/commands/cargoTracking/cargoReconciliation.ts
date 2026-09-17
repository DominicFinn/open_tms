/**
 * Reconciliation steps shared by the cargo tracking command handlers. Each step runs against the
 * handler's transaction client and reports the events it wants published through `emitCargo`, so
 * they persist with the writes and fan out after commit.
 *
 * Every lookup is scoped to the command's orgId: a stop or unit belonging to another tenant reads
 * as not found.
 */

import { TransactionClient } from '../BaseCommandHandler.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';

export type DiscrepancyType =
  | 'misdrop_early' | 'misdrop_late' | 'missing_at_stop' | 'unexpected_at_stop'
  | 'left_on_vehicle' | 'damaged' | 'wrong_destination';

export type EmitCargoFn = (type: string, trackableUnitId: string, payload: Record<string, unknown>) => void;

export class CargoScopeError extends Error {}

export interface ReconciliationResult {
  stopId?: string;
  shipmentId: string;
  missingUnits: string[];
  unexpectedUnits: string[];
  leftOnVehicle: string[];
  discrepanciesCreated: number;
}

export function emptyResult(shipmentId: string, stopId?: string): ReconciliationResult {
  return { stopId, shipmentId, missingUnits: [], unexpectedUnits: [], leftOnVehicle: [], discrepanciesCreated: 0 };
}

export async function findStopWithExpectedUnits(tx: TransactionClient, orgId: string, shipmentStopId: string) {
  const stop = await tx.shipmentStop.findFirst({
    where: { id: shipmentStopId, shipment: { orgId } },
    include: {
      location: true,
      orders: { include: { trackableUnits: true } },
      cargoScans: { where: { orgId, scanType: 'unload' } },
    },
  });
  if (!stop) throw new CargoScopeError('Shipment stop not found');
  return stop;
}

export async function setUnitLocation(tx: TransactionClient, orgId: string, trackableUnitId: string, currentStopId: string) {
  await tx.trackableUnit.update({ where: { id: trackableUnitId, order: { orgId } }, data: { currentStopId } });
}

/**
 * Auto-mark every unit expected at a stop as unloaded there. Used for geofence and other automatic
 * completions, where nobody scans.
 */
export async function autoScanStop(
  tx: TransactionClient,
  orgId: string,
  stop: Awaited<ReturnType<typeof findStopWithExpectedUnits>>,
  method: string,
): Promise<number> {
  const scanMethod = method === 'geofence_iot' ? 'iot' : method === 'geofence' ? 'geofence' : 'manual';
  let count = 0;
  for (const order of stop.orders) {
    for (const unit of order.trackableUnits) {
      await setUnitLocation(tx, orgId, unit.id, stop.id);
      await tx.cargoScan.create({
        data: {
          orgId,
          trackableUnitId: unit.id,
          shipmentStopId: stop.id,
          shipmentId: stop.shipmentId,
          scanType: 'unload',
          scanMethod,
          scannedBy: `system:${method}`,
          expected: true,
        },
      });
      count++;
    }
  }
  return count;
}

/**
 * Compare the units expected at a stop with the units unloaded there, and raise a discrepancy for
 * each expected unit that was never scanned.
 */
export async function reconcileStop(
  tx: TransactionClient,
  orgId: string,
  shipmentStopId: string,
  emitCargo: EmitCargoFn,
): Promise<ReconciliationResult> {
  const stop = await findStopWithExpectedUnits(tx, orgId, shipmentStopId);
  const result = emptyResult(stop.shipmentId, shipmentStopId);

  const units = new Map<string, { unitType: string; identifier: string; orderNumber: string }>();
  for (const order of stop.orders) {
    for (const unit of order.trackableUnits) {
      units.set(unit.id, { unitType: unit.unitType, identifier: unit.identifier, orderNumber: order.orderNumber });
    }
  }
  const scannedUnitIds = new Set(stop.cargoScans.map((s) => s.trackableUnitId));

  // BUSINESS RULE: a completed stop with no unload scans at all was completed automatically
  // (geofence, IoT), so every expected unit is assumed delivered rather than missing.
  if (scannedUnitIds.size === 0 && units.size > 0) {
    for (const unitId of units.keys()) await setUnitLocation(tx, orgId, unitId, shipmentStopId);
    return result;
  }

  for (const [unitId, unit] of units) {
    if (scannedUnitIds.has(unitId)) continue;
    result.missingUnits.push(unitId);
    await tx.cargoDiscrepancy.create({
      data: {
        orgId,
        shipmentId: stop.shipmentId,
        trackableUnitId: unitId,
        discrepancyType: 'missing_at_stop',
        severity: 'high',
        expectedStopId: shipmentStopId,
        detectedBy: 'system',
        description: `${unit.unitType} "${unit.identifier}" expected at ${stop.location.name} but was not scanned on unload`,
      },
    });
    result.discrepanciesCreated++;
    emitCargo(EVENT_TYPES.CARGO_MISSING_AT_STOP, unitId, {
      shipmentId: stop.shipmentId,
      unitIdentifier: unit.identifier,
      unitType: unit.unitType,
      stopName: stop.location.name,
      orderNumber: unit.orderNumber,
    });
  }

  // Units unloaded here but not expected already got a misdrop discrepancy when they were scanned.
  for (const unitId of scannedUnitIds) {
    if (!units.has(unitId)) result.unexpectedUnits.push(unitId);
  }
  return result;
}

/**
 * Once every stop is completed or skipped, any unit with no current stop was never confirmed
 * delivered and may still be on the vehicle.
 */
export async function checkLeftOnVehicle(
  tx: TransactionClient,
  orgId: string,
  shipmentId: string,
  emitCargo: EmitCargoFn,
): Promise<ReconciliationResult> {
  const shipment = await tx.shipment.findFirst({ where: { id: shipmentId, orgId }, select: { id: true } });
  if (!shipment) throw new CargoScopeError('Shipment not found');

  const result = emptyResult(shipmentId);
  const stops = await tx.shipmentStop.findMany({ where: { shipmentId, shipment: { orgId } }, select: { status: true } });
  if (!stops.every((s) => s.status === 'completed' || s.status === 'skipped')) return result;

  const orderShipments = await tx.orderShipment.findMany({
    where: { shipmentId, order: { orgId } },
    include: { order: { include: { trackableUnits: true } } },
  });

  for (const { order } of orderShipments) {
    for (const unit of order.trackableUnits) {
      if (unit.currentStopId) continue;
      result.leftOnVehicle.push(unit.id);
      await tx.cargoDiscrepancy.create({
        data: {
          orgId,
          shipmentId,
          trackableUnitId: unit.id,
          discrepancyType: 'left_on_vehicle',
          severity: 'critical',
          expectedStopId: order.deliveryStopId || undefined,
          detectedBy: 'system',
          description: `${unit.unitType} "${unit.identifier}" was never confirmed delivered and may still be on the vehicle`,
        },
      });
      result.discrepanciesCreated++;
      emitCargo(EVENT_TYPES.CARGO_LEFT_ON_VEHICLE, unit.id, {
        shipmentId,
        unitIdentifier: unit.identifier,
        unitType: unit.unitType,
        orderId: unit.orderId,
        orderNumber: order.orderNumber,
      });
    }
  }
  return result;
}
