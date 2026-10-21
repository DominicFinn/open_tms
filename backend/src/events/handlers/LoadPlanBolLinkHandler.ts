/**
 * LoadPlanBolLinkHandler (WMS): records the BOL that transport generated for a sealed load (#359).
 *
 * BOL generation is TMS and publishes `load_plan.bol_generated`; the load plan is a warehouse row,
 * so the warehouse writes the link itself. The conditional update keeps the first document if two
 * arrive, so a redelivered or duplicated event is harmless.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';

interface BolGeneratedPayload {
  loadPlanId?: string;
  documentId?: string;
}

export class LoadPlanBolLinkHandler implements IEventHandler {
  readonly name = 'handler.load_plan_bol_link';
  readonly eventPatterns = [EVENT_TYPES.LOAD_PLAN_BOL_GENERATED];
  readonly options: SubscribeOptions = { concurrency: 2, priority: 10, retryLimit: 5 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    const payload = (event.payload ?? {}) as BolGeneratedPayload;
    const loadPlanId = payload.loadPlanId ?? event.entityId;
    if (!loadPlanId || !payload.documentId) return;

    await this.prisma.loadPlan.updateMany({
      where: { id: loadPlanId, orgId: event.orgId, bolDocumentId: null },
      data: { bolDocumentId: payload.documentId },
    });
  }
}
