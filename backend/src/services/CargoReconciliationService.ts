import { randomUUID } from 'crypto';
import { ICommandBus } from '../commands/CommandBus.js';
import { CommandResult } from '../commands/types.js';
import { RECONCILE_STOP_CARGO, CHECK_LEFT_ON_VEHICLE } from '../commands/cargoTracking/index.js';
import { ReconciliationResult } from '../commands/cargoTracking/cargoReconciliation.js';

export class CargoReconciliationFailedError extends Error {}

/**
 * Entry point for system-driven cargo reconciliation (stop completion from geofence, IoT or the
 * delivery flow). The work itself lives in the cargo tracking command handlers; this dispatches
 * them under the shipment's own org.
 */
export interface ICargoReconciliationService {
  /** Auto-scan the stop's expected units with `method`, then reconcile expected against unloaded. */
  reconcileCompletedStop(orgId: string, shipmentStopId: string, method: string): Promise<ReconciliationResult>;

  /** Raise a discrepancy for every unit never confirmed delivered once all stops are done. */
  checkLeftOnVehicle(orgId: string, shipmentId: string): Promise<ReconciliationResult>;
}

export class CargoReconciliationService implements ICargoReconciliationService {
  constructor(private commandBus: ICommandBus) {}

  async reconcileCompletedStop(orgId: string, shipmentStopId: string, method: string): Promise<ReconciliationResult> {
    return unwrap(await this.commandBus.dispatch<unknown, ReconciliationResult>({
      type: RECONCILE_STOP_CARGO,
      orgId,
      actorId: null,
      payload: { shipmentStopId, autoScanMethod: method },
      metadata: { correlationId: randomUUID(), source: 'system' },
    }));
  }

  async checkLeftOnVehicle(orgId: string, shipmentId: string): Promise<ReconciliationResult> {
    return unwrap(await this.commandBus.dispatch<unknown, ReconciliationResult>({
      type: CHECK_LEFT_ON_VEHICLE,
      orgId,
      actorId: null,
      payload: { shipmentId },
      metadata: { correlationId: randomUUID(), source: 'system' },
    }));
  }
}

function unwrap(result: CommandResult<ReconciliationResult>): ReconciliationResult {
  if (!result.success || !result.data) throw new CargoReconciliationFailedError(result.error ?? 'Cargo reconciliation failed');
  return result.data;
}
