import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateShipmentTypePayload {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  defaults?: Record<string, unknown>;
  requiredFields?: string[];
  isBuiltIn?: boolean;
}

export const CREATE_SHIPMENT_TYPE = 'shipment_type.create';

export class CreateShipmentTypeCommandHandler extends BaseCommandHandler<CreateShipmentTypePayload, { id: string; name: string }> {
  readonly commandType = CREATE_SHIPMENT_TYPE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateShipmentTypePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const p = command.payload;
    const created = await tx.shipmentType.create({
      data: {
        name: p.name,
        icon: p.icon ?? 'local_shipping',
        color: p.color ?? '#6366F1',
        description: p.description,
        defaults: (p.defaults ?? {}) as any,
        requiredFields: p.requiredFields ?? [],
        isBuiltIn: p.isBuiltIn ?? false,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_TYPE_CREATED,
      entityType: 'shipment_type',
      entityId: created.id,
      payload: { name: created.name, icon: created.icon, isBuiltIn: created.isBuiltIn },
    }));

    return { id: created.id, name: created.name };
  }
}
