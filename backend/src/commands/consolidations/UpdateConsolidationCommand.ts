import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { reconcileDevices, ShipmentDeviceInput } from '../shipments/reconcileShipmentDevices.js';
import { pushCarrierToShipments, shipmentUpdatedEvents } from './consolidationMembership.js';

export interface UpdateConsolidationPayload {
  id: string;
  carrierId?: string | null;
  notes?: string | null;
  /** The tracking devices on the run; undefined leaves them alone, [] removes them all. */
  devices?: ShipmentDeviceInput[];
}

export const UPDATE_CONSOLIDATION = 'consolidation.update';

export class UpdateConsolidationCommandHandler extends BaseCommandHandler<UpdateConsolidationPayload, { id: string }> {
  readonly commandType = UPDATE_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateConsolidationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { orgId } = command;
    const { id, carrierId, notes, devices } = command.payload;

    const existing = await tx.consolidation.findFirst({
      where: { id, orgId },
      select: { id: true, shipments: { select: { shipmentId: true } } },
    });
    if (!existing) throw new Error('Consolidation not found');
    if (carrierId) {
      const carrier = await tx.carrier.findFirst({ where: { id: carrierId, orgId }, select: { id: true } });
      if (!carrier) throw new Error('Carrier not found');
    }

    const data: { carrierId?: string | null; notes?: string | null } = {};
    if (carrierId !== undefined) data.carrierId = carrierId;
    if (notes !== undefined) data.notes = notes;
    await tx.consolidation.update({ where: { id, orgId }, data });

    const carried = await pushCarrierToShipments(tx, orgId, carrierId, existing.shipments.map((s) => s.shipmentId));

    await reconcileDevices(tx, {
      orgId,
      owner: { consolidationId: id },
      devices,
      emitAssigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_ASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, consolidationId: id },
      })),
      emitUnassigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_UNASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, consolidationId: id },
      })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_UPDATED,
      entityType: 'consolidation',
      entityId: id,
      payload: { changes: [...Object.keys(data), ...(devices !== undefined ? ['devices'] : [])] },
    }));
    for (const e of shipmentUpdatedEvents(carried, ['carrierId'], id)) emit(this.createEvent(command, e));

    return { id };
  }
}
