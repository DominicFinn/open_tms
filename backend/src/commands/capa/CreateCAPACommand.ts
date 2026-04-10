/**
 * CreateCAPACommand — creates a new Corrective and Preventive Action report.
 *
 * Auto-generates a report number in the format CAPA-YYYYMMDD-NNN where NNN
 * is the sequential count for that day, zero-padded to 3 digits.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCAPAPayload {
  issueId: string;
  shipmentId?: string;
  title: string;
  description: string;
  priority?: string;
  immediateAction?: string;
  containmentAction?: string;
  investigatorId?: string;
  investigatorName?: string;
  affectedProducts?: unknown;
  affectedShipmentIds?: unknown;
  affectedLocationIds?: unknown;
  eventTimeline?: unknown;
  temperatureData?: unknown;
}

export const CREATE_CAPA = 'capa.create';

export class CreateCAPACommandHandler extends BaseCommandHandler<CreateCAPAPayload, { id: string; reportNumber: string }> {
  readonly commandType = CREATE_CAPA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCAPAPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; reportNumber: string }> {
    const { issueId, shipmentId, title, description, priority, immediateAction, containmentAction, investigatorId, investigatorName, affectedProducts, affectedShipmentIds, affectedLocationIds, eventTimeline, temperatureData } = command.payload;

    // Auto-generate report number: CAPA-YYYYMMDD-NNN
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CAPA-${dateStr}-`;

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayCount = await tx.cAPAReport.count({
      where: {
        orgId: command.orgId,
        createdAt: { gte: todayStart, lt: todayEnd },
      },
    });

    const reportNumber = `${prefix}${String(todayCount + 1).padStart(3, '0')}`;

    const capa = await tx.cAPAReport.create({
      data: {
        orgId: command.orgId,
        issueId,
        shipmentId,
        reportNumber,
        title,
        description,
        priority: priority ?? 'medium',
        immediateAction,
        containmentAction,
        investigatorId,
        investigatorName,
        affectedProducts: affectedProducts ?? undefined,
        affectedShipmentIds: affectedShipmentIds ?? undefined,
        affectedLocationIds: affectedLocationIds ?? undefined,
        eventTimeline: eventTimeline ?? undefined,
        temperatureData: temperatureData ?? undefined,
        createdBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CAPA_CREATED,
      entityType: 'capa_report',
      entityId: capa.id,
      payload: {
        reportNumber,
        title,
        issueId,
        shipmentId,
        priority: capa.priority,
      },
    }));

    return { id: capa.id, reportNumber };
  }
}
