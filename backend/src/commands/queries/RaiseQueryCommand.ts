import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RaiseQueryPayload {
  queryType: 'customer_dispute' | 'carrier_dispute';
  invoiceId?: string;
  carrierInvoiceId?: string;
  shipmentId?: string;
  reason: string;
  description: string;
  disputedAmountCents?: number;
  cargoDiscrepancyId?: string;
  coldChainExcursionId?: string;
  assigneeId?: string;
}

export const RAISE_QUERY = 'financial_query.raise';

export class RaiseQueryCommandHandler extends BaseCommandHandler<RaiseQueryPayload, { id: string; queryNumber: string }> {
  readonly commandType = RAISE_QUERY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<RaiseQueryPayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    // Generate query number
    const latest = await tx.financialQuery.findFirst({
      where: { orgId: command.orgId },
      orderBy: { queryNumber: 'desc' },
      select: { queryNumber: true },
    });
    const seq = latest ? parseInt(latest.queryNumber.slice(4), 10) + 1 : 1;
    const queryNumber = `QRY-${String(seq).padStart(4, '0')}`;

    const query = await tx.financialQuery.create({
      data: {
        orgId: command.orgId,
        queryNumber,
        queryType: payload.queryType,
        invoiceId: payload.invoiceId,
        carrierInvoiceId: payload.carrierInvoiceId,
        shipmentId: payload.shipmentId,
        reason: payload.reason,
        description: payload.description,
        disputedAmountCents: payload.disputedAmountCents,
        cargoDiscrepancyId: payload.cargoDiscrepancyId,
        coldChainExcursionId: payload.coldChainExcursionId,
        assigneeId: payload.assigneeId,
        status: 'raised',
        createdBy: command.actorId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.FINANCIAL_QUERY_RAISED,
      entityType: 'financial_query',
      entityId: query.id,
      payload: {
        queryId: query.id,
        queryNumber,
        queryType: payload.queryType,
        reason: payload.reason,
        disputedAmountCents: payload.disputedAmountCents,
        shipmentId: payload.shipmentId,
      },
    }));

    return { id: query.id, queryNumber };
  }
}
