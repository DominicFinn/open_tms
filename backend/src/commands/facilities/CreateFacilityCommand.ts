import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateFacilityPayload {
  name: string;
  code?: string | null;
  /** Soft link to the core Location this facility corresponds to, where one exists. */
  sourceLocationId?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  timezone?: string | null;
}

export const CREATE_FACILITY = 'facility.create';

export class CreateFacilityCommandHandler extends BaseCommandHandler<
  CreateFacilityPayload,
  { id: string; name: string }
> {
  readonly commandType = CREATE_FACILITY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateFacilityPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const p = command.payload;

    if (p.sourceLocationId) {
      const clash = await tx.facility.findUnique({
        where: { orgId_sourceLocationId: { orgId: command.orgId, sourceLocationId: p.sourceLocationId } },
        select: { id: true },
      });
      if (clash) throw new Error('A facility already exists for that location');
    }

    const facility = await tx.facility.create({
      data: {
        orgId: command.orgId,
        name: p.name,
        code: p.code ?? null,
        sourceLocationId: p.sourceLocationId ?? null,
        address1: p.address1 ?? null,
        address2: p.address2 ?? null,
        city: p.city ?? null,
        state: p.state ?? null,
        postalCode: p.postalCode ?? null,
        country: p.country ?? null,
        timezone: p.timezone ?? null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.FACILITY_CREATED,
      entityType: 'facility',
      entityId: facility.id,
      payload: { sourceLocationId: facility.sourceLocationId, derived: false },
    }));

    return { id: facility.id, name: facility.name };
  }
}
