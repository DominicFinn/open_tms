/**
 * UpdateColdChainProfileCommand — updates an existing cold chain profile.
 *
 * Emits a deactivation event if the profile is being set to inactive,
 * otherwise emits a general update event.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateColdChainProfilePayload {
  id: string;
  data: {
    name?: string;
    description?: string;
    minTemperature?: number;
    maxTemperature?: number;
    alertMinTemperature?: number;
    alertMaxTemperature?: number;
    minHumidity?: number;
    maxHumidity?: number;
    alertMinHumidity?: number;
    alertMaxHumidity?: number;
    active?: boolean;
  };
}

export const UPDATE_COLD_CHAIN_PROFILE = 'cold_chain_profile.update';

export class UpdateColdChainProfileCommandHandler extends BaseCommandHandler<UpdateColdChainProfilePayload, { id: string }> {
  readonly commandType = UPDATE_COLD_CHAIN_PROFILE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateColdChainProfilePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const previous = await tx.coldChainProfile.findUniqueOrThrow({ where: { id } });

    const updated = await tx.coldChainProfile.update({
      where: { id },
      data: {
        ...data,
        updatedBy: command.actorId,
      },
    });

    if (data.active === false && previous.active === true) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.COLD_CHAIN_PROFILE_DEACTIVATED,
        entityType: 'cold_chain_profile',
        entityId: id,
        payload: {
          name: updated.name,
        },
      }));
    } else {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.COLD_CHAIN_PROFILE_UPDATED,
        entityType: 'cold_chain_profile',
        entityId: id,
        payload: {
          name: updated.name,
          changes: Object.keys(data),
        },
      }));
    }

    return { id };
  }
}
