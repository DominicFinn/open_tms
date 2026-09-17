import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { autoScanStop, findStopWithExpectedUnits, reconcileStop, ReconciliationResult } from './cargoReconciliation.js';

export interface ReconcileStopCargoPayload {
  shipmentStopId: string;
  /**
   * Set when the stop was completed automatically (geofence, IoT). Every expected unit is scanned
   * as unloaded with this method before reconciling.
   */
  autoScanMethod?: string;
}

export const RECONCILE_STOP_CARGO = 'cargo.reconcile_stop';

export class ReconcileStopCargoCommandHandler extends BaseCommandHandler<ReconcileStopCargoPayload, ReconciliationResult> {
  readonly commandType = RECONCILE_STOP_CARGO;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<ReconcileStopCargoPayload>, tx: TransactionClient, emit: EmitFn) {
    const { orgId, payload } = command;
    if (payload.autoScanMethod) {
      const stop = await findStopWithExpectedUnits(tx, orgId, payload.shipmentStopId);
      await autoScanStop(tx, orgId, stop, payload.autoScanMethod);
    }

    return reconcileStop(tx, orgId, payload.shipmentStopId, (type, trackableUnitId, eventPayload) =>
      emit(this.createEvent(command, {
        type,
        entityType: 'trackable_unit',
        entityId: trackableUnitId,
        payload: { ...eventPayload, trackableUnitId },
      })),
    );
  }
}
