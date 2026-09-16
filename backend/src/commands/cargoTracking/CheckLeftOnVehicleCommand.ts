import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { checkLeftOnVehicle, ReconciliationResult } from './cargoReconciliation.js';

export interface CheckLeftOnVehiclePayload {
  shipmentId: string;
}

export const CHECK_LEFT_ON_VEHICLE = 'cargo.check_left_on_vehicle';

export class CheckLeftOnVehicleCommandHandler extends BaseCommandHandler<CheckLeftOnVehiclePayload, ReconciliationResult> {
  readonly commandType = CHECK_LEFT_ON_VEHICLE;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CheckLeftOnVehiclePayload>, tx: TransactionClient, emit: EmitFn) {
    return checkLeftOnVehicle(tx, command.orgId, command.payload.shipmentId, (type, trackableUnitId, eventPayload) =>
      emit(this.createEvent(command, {
        type,
        entityType: 'trackable_unit',
        entityId: trackableUnitId,
        payload: { ...eventPayload, trackableUnitId },
      })),
    );
  }
}
