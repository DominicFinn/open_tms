/**
 * CreateColdChainProfileCommand — creates a new cold chain temperature profile.
 *
 * Profiles define acceptable temperature/humidity ranges and alert thresholds
 * that are applied to shipments for monitoring.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateColdChainProfilePayload {
  name: string;
  description?: string;
  minTemperature: number;
  maxTemperature: number;
  alertMinTemperature: number;
  alertMaxTemperature: number;
  minHumidity?: number;
  maxHumidity?: number;
  alertMinHumidity?: number;
  alertMaxHumidity?: number;
}

export const CREATE_COLD_CHAIN_PROFILE = 'cold_chain_profile.create';

export class CreateColdChainProfileCommandHandler extends BaseCommandHandler<CreateColdChainProfilePayload, { id: string; name: string }> {
  readonly commandType = CREATE_COLD_CHAIN_PROFILE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateColdChainProfilePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const profile = await tx.coldChainProfile.create({
      data: {
        orgId: command.orgId,
        createdBy: command.actorId,
        ...command.payload,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COLD_CHAIN_PROFILE_CREATED,
      entityType: 'cold_chain_profile',
      entityId: profile.id,
      payload: {
        name: profile.name,
        minTemperature: profile.minTemperature,
        maxTemperature: profile.maxTemperature,
        alertMinTemperature: profile.alertMinTemperature,
        alertMaxTemperature: profile.alertMaxTemperature,
      },
    }));

    return { id: profile.id, name: profile.name };
  }
}
