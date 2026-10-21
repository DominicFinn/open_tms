/**
 * BolGenerationHandler — generates the Bill of Lading when a warehouse load is sealed.
 *
 * The first deliberate cross-domain subscriber. Completing a load plan is a warehouse act and
 * the BOL is a transport document, so WMS emits `load_plan.completed` and this, on the TMS side,
 * decides what that means for paperwork. A standalone FinnWMS registers no subscriber, produces
 * no BOL, and nothing in the warehouse notices.
 *
 * The load plan is a warehouse row, so this handler neither reads nor writes it (#359). It
 * publishes `load_plan.bol_generated` with the document, and the warehouse records the link.
 *
 * IDEMPOTENCY: pg-boss redelivers on failure, so the handler skips a load plan it has already
 * published a BOL for, found in the event log. Two concurrent deliveries can each render a PDF,
 * but the warehouse keeps only the first link: a wasted render is cheap, a load plan pointing at
 * two BOLs is not.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { IEventBus } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { createEvent } from '../createEvent.js';
import { IDocumentGenerationService } from '../../services/DocumentGenerationService.js';

interface LoadPlanCompletedPayload {
  shipmentId?: string | null;
  sealNumber?: string | null;
  trailerNumber?: string | null;
  bolRequested?: boolean;
}

export class BolGenerationHandler implements IEventHandler {
  readonly name = 'document.bol_generation';
  readonly eventPatterns = [EVENT_TYPES.LOAD_PLAN_COMPLETED];
  readonly options: SubscribeOptions = {
    concurrency: 2,
    priority: 3,
    retryLimit: 3,
    expireInSeconds: 900,
  };

  constructor(
    private prisma: PrismaClient,
    private documentService: IDocumentGenerationService,
    private eventBus: IEventBus
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const payload = (event.payload ?? {}) as LoadPlanCompletedPayload;
    if (!payload.bolRequested || !payload.shipmentId) return;

    const loadPlanId = event.entityId;
    const alreadyGenerated = await this.prisma.domainEventLog.findFirst({
      where: { orgId: event.orgId, type: EVENT_TYPES.LOAD_PLAN_BOL_GENERATED, entityType: 'load_plan', entityId: loadPlanId },
      select: { id: true },
    });
    if (alreadyGenerated) return;

    const document = await this.documentService.generateBOL(
      event.orgId,
      payload.shipmentId,
      undefined,
      event.actorId ?? undefined
    );

    await this.eventBus.publish(
      createEvent({
        type: EVENT_TYPES.LOAD_PLAN_BOL_GENERATED,
        entityType: 'load_plan',
        entityId: loadPlanId,
        orgId: event.orgId,
        actorId: event.actorId ?? undefined,
        payload: {
          loadPlanId,
          shipmentId: payload.shipmentId,
          documentId: document.id,
          fileName: document.fileName,
        },
        correlationId: event.metadata?.correlationId,
        causationId: event.id,
        source: 'bol_generation_handler',
      })
    );
  }
}
