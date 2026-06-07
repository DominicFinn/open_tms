import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateLanePayload {
  name: string;
  /** Multi-tenancy scope. Route handlers thread this from the JWT. */
  orgId?: string | null;
  originId: string;
  destinationId: string;
  distance?: number;
  notes?: string;
  serviceLevel?: string;
  stops?: Array<{ locationId: string; order: number; notes?: string }>;
}

export const CREATE_LANE = 'lane.create';

export class CreateLaneCommandHandler extends BaseCommandHandler<CreateLanePayload, { id: string; name: string }> {
  readonly commandType = CREATE_LANE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateLanePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { stops, orgId: payloadOrgId, ...laneData } = command.payload;

    // Multi-tenancy: prefer the payload's orgId, fall back to command.orgId
    // (the JWT path). Lane.orgId is NOT NULL post phase-3 tightening — we
    // throw rather than write a half-built row when neither source
    // supplies one.
    const orgIdToWrite = payloadOrgId || command.orgId;
    if (!orgIdToWrite) {
      throw new Error('orgId is required to create a Lane (multi-tenancy)');
    }

    const lane = await tx.lane.create({ data: { ...laneData, orgId: orgIdToWrite } });

    if (stops?.length) {
      await tx.laneStop.createMany({
        data: stops.map((s) => ({ ...s, laneId: lane.id })),
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LANE_CREATED,
      entityType: 'lane',
      entityId: lane.id,
      payload: { name: lane.name, originId: lane.originId, destinationId: lane.destinationId },
    }));

    return { id: lane.id, name: lane.name };
  }
}
