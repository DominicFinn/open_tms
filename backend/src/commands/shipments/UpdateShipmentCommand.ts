import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { reconcileShipmentDevices } from './reconcileShipmentDevices.js';
import { syncShipmentStops } from './syncShipmentStops.js';

export interface UpdateShipmentPayload {
  id: string;
  data: {
    reference?: string;
    status?: string;
    pickupDate?: Date | string;
    deliveryDate?: Date | string;
    pickupWindowStart?: Date | string;
    pickupWindowEnd?: Date | string;
    deliveryWindowStart?: Date | string;
    deliveryWindowEnd?: Date | string;
    shipmentTypeId?: string | null;
    customerId?: string;
    laneId?: string;
    carrierId?: string | null;
    proNumber?: string | null;
    originId?: string;
    destinationId?: string;
    items?: Array<{ sku: string; description?: string; quantity: number; weightKg?: number; volumeM3?: number }>;
    devices?: Array<{ name: string; externalId: string }>;
    waypoints?: string[];
  };
}

export const UPDATE_SHIPMENT = 'shipment.update';

export class UpdateShipmentCommandHandler extends BaseCommandHandler<UpdateShipmentPayload, { id: string }> {
  readonly commandType = UPDATE_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;

    const previous = await tx.shipment.findFirstOrThrow({ where: { id, archived: false } });

    // Resolve lane origin/destination if laneId provided
    const updateData: any = { ...data };
    // `devices` and `waypoints` are not Shipment columns — they are reconciled
    // separately below.
    delete updateData.devices;
    delete updateData.waypoints;
    if (data.laneId) {
      const lane = await tx.lane.findFirstOrThrow({ where: { id: data.laneId, archived: false } });
      updateData.originId = lane.originId;
      updateData.destinationId = lane.destinationId;
    }

    const updated = await tx.shipment.update({ where: { id }, data: updateData });

    // Rebuild the stop list from the route, but ONLY while the shipment is a
    // draft — in-flight shipments carry stop-level progress we must not wipe.
    if (data.waypoints !== undefined && updated.status === 'draft') {
      await syncShipmentStops(tx, {
        shipmentId: id,
        originId: updated.originId,
        waypoints: data.waypoints,
        destinationId: updated.destinationId,
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_UPDATED,
      entityType: 'shipment',
      entityId: id,
      payload: { shipmentReference: updated.reference },
    }));

    if (data.status && data.status !== previous.status) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
        entityType: 'shipment',
        entityId: id,
        payload: {
          previousStatus: previous.status,
          newStatus: data.status,
          shipmentReference: updated.reference,
        },
      }));
    }

    if (data.carrierId && data.carrierId !== previous.carrierId) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_CARRIER_ASSIGNED,
        entityType: 'shipment',
        entityId: id,
        payload: { carrierId: data.carrierId, shipmentReference: updated.reference },
      }));
    }

    // Reconcile IoT device assignments (no-op when `devices` is omitted).
    await reconcileShipmentDevices(tx, {
      orgId: command.orgId,
      shipmentId: id,
      devices: data.devices,
      emitAssigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_ASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, shipmentId: id },
      })),
      emitUnassigned: (deviceId, assignmentId) => emit(this.createEvent(command, {
        type: EVENT_TYPES.DEVICE_UNASSIGNED,
        entityType: 'device',
        entityId: deviceId,
        payload: { assignmentId, shipmentId: id },
      })),
    });

    return { id };
  }
}
