/**
 * BolGenerationHandler — generates the Bill of Lading when a warehouse load is sealed.
 *
 * The first deliberate cross-domain subscriber. Completing a load plan is a warehouse act and
 * the BOL is a transport document, so WMS emits `load_plan.completed` and this, on the TMS side,
 * decides what that means for paperwork. A standalone FinnWMS registers no subscriber, produces
 * no BOL, and nothing in the warehouse notices.
 *
 * IDEMPOTENCY: pg-boss redelivers on failure, so the handler skips a load plan that already has
 * a document, and claims the link with a conditional update rather than a blind write. Two
 * concurrent deliveries can each render a PDF, but only one link is ever recorded: a wasted
 * render is cheap, a load plan pointing at two BOLs is not.
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

    const plan = await this.prisma.loadPlan.findFirst({
      where: { id: event.entityId, orgId: event.orgId },
      select: { id: true, bolDocumentId: true },
    });
    if (!plan || plan.bolDocumentId) return;

    const document = await this.documentService.generateBOL(
      payload.shipmentId,
      undefined,
      event.actorId ?? undefined
    );

    const claimed = await this.prisma.loadPlan.updateMany({
      where: { id: plan.id, orgId: event.orgId, bolDocumentId: null },
      data: { bolDocumentId: document.id },
    });

    if (claimed.count === 0) {
      console.warn('[BolGenerationHandler] BOL already linked, discarding duplicate', {
        loadPlanId: plan.id,
        orgId: event.orgId,
      });
      return;
    }

    await this.eventBus.publish(
      createEvent({
        type: EVENT_TYPES.LOAD_PLAN_BOL_GENERATED,
        entityType: 'load_plan',
        entityId: plan.id,
        orgId: event.orgId,
        actorId: event.actorId ?? undefined,
        payload: {
          loadPlanId: plan.id,
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
