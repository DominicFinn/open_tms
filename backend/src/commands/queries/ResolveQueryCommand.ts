import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ResolveQueryPayload {
  queryId: string;
  resolution: 'adjusted' | 'upheld';
  resolutionNotes: string;
  adjustmentCents?: number;
  createCreditNote?: boolean;
}

export const RESOLVE_QUERY = 'financial_query.resolve';

export class ResolveQueryCommandHandler extends BaseCommandHandler<ResolveQueryPayload, { id: string; creditNoteId?: string }> {
  readonly commandType = RESOLVE_QUERY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ResolveQueryPayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    const query = await tx.financialQuery.findUnique({
      where: { id: payload.queryId },
    });
    if (!query) throw new Error('Financial query not found');

    if (!['raised', 'investigating'].includes(query.status)) {
      throw new Error(`Cannot resolve query in status "${query.status}"`);
    }

    const status = payload.resolution === 'adjusted' ? 'resolved_adjusted' : 'resolved_upheld';

    let creditNoteId: string | undefined;

    // If adjusted and credit note requested, create one
    if (payload.resolution === 'adjusted' && payload.createCreditNote && payload.adjustmentCents) {
      const latest = await tx.creditNote.findFirst({
        where: { orgId: command.orgId },
        orderBy: { creditNoteNumber: 'desc' },
        select: { creditNoteNumber: true },
      });
      const seq = latest ? parseInt(latest.creditNoteNumber.slice(3), 10) + 1 : 1;
      const creditNoteNumber = `CN-${String(seq).padStart(4, '0')}`;

      const isCustomerDispute = query.queryType === 'customer_dispute';

      const creditNote = await tx.creditNote.create({
        data: {
          orgId: command.orgId,
          creditNoteNumber,
          noteType: 'credit',
          invoiceId: isCustomerDispute ? query.invoiceId : undefined,
          customerId: isCustomerDispute ? undefined : undefined, // Could resolve from invoice
          carrierId: !isCustomerDispute ? undefined : undefined,
          amountCents: payload.adjustmentCents,
          currency: 'USD',
          reason: query.reason,
          description: `Adjustment for ${query.queryNumber}: ${payload.resolutionNotes}`,
          queryId: query.id,
          status: 'draft',
          createdBy: command.actorId,
        },
      });

      creditNoteId = creditNote.id;

      emit(this.createEvent(command, {
        type: EVENT_TYPES.CREDIT_NOTE_CREATED,
        entityType: 'credit_note',
        entityId: creditNote.id,
        payload: {
          creditNoteId: creditNote.id,
          creditNoteNumber,
          queryId: query.id,
          amountCents: payload.adjustmentCents,
          noteType: 'credit',
        },
      }));
    }

    await tx.financialQuery.update({
      where: { id: query.id },
      data: {
        status,
        resolvedBy: command.actorId,
        resolvedAt: new Date(),
        resolutionNotes: payload.resolutionNotes,
        adjustmentCents: payload.adjustmentCents,
        creditNoteId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.FINANCIAL_QUERY_RESOLVED,
      entityType: 'financial_query',
      entityId: query.id,
      payload: {
        queryId: query.id,
        queryNumber: query.queryNumber,
        resolution: payload.resolution,
        adjustmentCents: payload.adjustmentCents,
        creditNoteId,
      },
    }));

    return { id: query.id, creditNoteId };
  }
}
