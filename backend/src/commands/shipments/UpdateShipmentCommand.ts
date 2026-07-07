import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { reconcileShipmentDevices } from './reconcileShipmentDevices.js';

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
    serviceLevel?: string | null;
    customerId?: string;
    laneId?: string;
    carrierId?: string | null;
    proNumber?: string | null;
    originId?: string;
    destinationId?: string;
    items?: Array<{ sku: string; description?: string; quantity: number; weightKg?: number; volumeM3?: number }>;
    devices?: Array<{ name: string; externalId: string }>;
    tempControlled?: boolean;
    tempMinC?: number | null;
    tempMaxC?: number | null;
    humidityControlled?: boolean;
    humidityMinPct?: number | null;
    humidityMaxPct?: number | null;
    hazmat?: boolean;
    unNumber?: string | null;
    hazmatClass?: string | null;
    packingGroup?: string | null;
    properShippingName?: string | null;
    requiredEquipmentType?: string | null;
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
    // `devices` is not a Shipment column — it's reconciled separately below.
    delete updateData.devices;
    if (data.laneId) {
      const lane = await tx.lane.findFirstOrThrow({ where: { id: data.laneId, archived: false } });
      updateData.originId = lane.originId;
      updateData.destinationId = lane.destinationId;
    }

    const updated = await tx.shipment.update({ where: { id }, data: updateData });

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
