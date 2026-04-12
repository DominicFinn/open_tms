import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CarrierInvoiceLineItemInput {
  shipmentId?: string;
  chargeType: string;
  description: string;
  amountCents: number;
  freightClass?: string;
  billedWeight?: number;
}

export interface ReceiveCarrierInvoicePayload {
  carrierId: string;
  invoiceNumber: string;
  totalCents: number;
  currency?: string;
  lineItems: CarrierInvoiceLineItemInput[];
  notes?: string;
  edi210Content?: string;
}

export const RECEIVE_CARRIER_INVOICE = 'carrier_invoice.receive';

export class ReceiveCarrierInvoiceCommandHandler extends BaseCommandHandler<ReceiveCarrierInvoicePayload, { id: string; matchStatus: string; autoApproved: boolean }> {
  readonly commandType = RECEIVE_CARRIER_INVOICE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ReceiveCarrierInvoicePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    // Validate carrier exists
    const carrier = await tx.carrier.findUnique({
      where: { id: payload.carrierId },
      select: { id: true, name: true, paymentTermsDays: true },
    });
    if (!carrier) throw new Error('Carrier not found');

    const receivedDate = new Date();
    const dueDate = new Date(receivedDate);
    dueDate.setDate(dueDate.getDate() + carrier.paymentTermsDays);

    // Perform three-way match against expected costs
    let totalExpectedCents = 0;
    let totalVariance = 0;
    const lineItemsWithMatch: Array<CarrierInvoiceLineItemInput & {
      expectedAmountCents: number | null;
      varianceCents: number | null;
      matchStatus: string;
      chargeId: string | null;
    }> = [];

    for (const item of payload.lineItems) {
      if (item.shipmentId) {
        const expectedCharges = await tx.charge.findMany({
          where: {
            shipmentId: item.shipmentId,
            chargeCategory: 'cost',
            chargeType: item.chargeType,
            status: { not: 'written_off' },
          },
        });

        const expectedTotal = expectedCharges.reduce((sum, c) => sum + c.amountCents, 0);

        if (expectedCharges.length > 0) {
          const variance = item.amountCents - expectedTotal;
          totalExpectedCents += expectedTotal;
          totalVariance += variance;
          lineItemsWithMatch.push({
            ...item,
            expectedAmountCents: expectedTotal,
            varianceCents: variance,
            matchStatus: variance === 0 ? 'matched' : 'variance',
            chargeId: expectedCharges[0].id,
          });
        } else {
          lineItemsWithMatch.push({
            ...item,
            expectedAmountCents: null,
            varianceCents: null,
            matchStatus: 'unmatched',
            chargeId: null,
          });
        }
      } else {
        lineItemsWithMatch.push({
          ...item,
          expectedAmountCents: null,
          varianceCents: null,
          matchStatus: 'unmatched',
          chargeId: null,
        });
      }
    }

    const hasUnmatched = lineItemsWithMatch.some(l => l.matchStatus === 'unmatched');
    const hasVariance = lineItemsWithMatch.some(l => l.matchStatus === 'variance');
    const overallMatchStatus = !hasUnmatched && !hasVariance ? 'matched'
      : hasUnmatched ? 'mismatch' : 'partial_match';

    const variancePercent = totalExpectedCents > 0
      ? Math.round((Math.abs(totalVariance) / totalExpectedCents) * 10000) / 100
      : 0;

    // Auto-approve if within 2% tolerance and no unmatched lines
    const autoApproved = !hasUnmatched && variancePercent <= 2.0;

    const invoiceStatus = autoApproved ? 'approved' : (overallMatchStatus === 'matched' ? 'matched' : 'discrepancy');

    const carrierInvoice = await tx.carrierInvoice.create({
      data: {
        orgId: command.orgId,
        invoiceNumber: payload.invoiceNumber,
        carrierId: payload.carrierId,
        status: invoiceStatus,
        totalCents: payload.totalCents,
        approvedCents: autoApproved ? payload.totalCents : undefined,
        currency: payload.currency ?? 'USD',
        paymentTermsDays: carrier.paymentTermsDays,
        receivedDate,
        dueDate,
        matchStatus: overallMatchStatus,
        varianceCents: totalVariance !== 0 ? totalVariance : undefined,
        variancePercent: variancePercent !== 0 ? variancePercent : undefined,
        autoApproved,
        edi210Content: payload.edi210Content,
        notes: payload.notes,
        ...(autoApproved && {
          approvedBy: 'system',
          approvedAt: new Date(),
        }),
        lineItems: {
          create: lineItemsWithMatch.map(item => ({
            shipmentId: item.shipmentId,
            chargeId: item.chargeId,
            chargeType: item.chargeType,
            description: item.description,
            amountCents: item.amountCents,
            currency: payload.currency ?? 'USD',
            expectedAmountCents: item.expectedAmountCents,
            varianceCents: item.varianceCents,
            matchStatus: item.matchStatus,
            freightClass: item.freightClass,
            billedWeight: item.billedWeight,
          })),
        },
      },
    });

    // Update shipment carrier payment status
    const shipmentIds = [...new Set(payload.lineItems.map(l => l.shipmentId).filter(Boolean) as string[])];
    if (shipmentIds.length > 0) {
      await tx.shipmentFinancialSummary.updateMany({
        where: { shipmentId: { in: shipmentIds } },
        data: {
          carrierPaymentStatus: autoApproved ? 'approved' : 'invoice_received',
        },
      });
    }

    // Emit events
    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_INVOICE_RECEIVED,
      entityType: 'carrier_invoice',
      entityId: carrierInvoice.id,
      payload: {
        carrierInvoiceId: carrierInvoice.id,
        carrierId: payload.carrierId,
        carrierName: carrier.name,
        invoiceNumber: payload.invoiceNumber,
        totalCents: payload.totalCents,
        matchStatus: overallMatchStatus,
        autoApproved,
      },
    }));

    if (overallMatchStatus !== 'matched' && !autoApproved) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.CARRIER_INVOICE_DISCREPANCY,
        entityType: 'carrier_invoice',
        entityId: carrierInvoice.id,
        payload: {
          carrierInvoiceId: carrierInvoice.id,
          carrierId: payload.carrierId,
          invoiceNumber: payload.invoiceNumber,
          varianceCents: totalVariance,
          variancePercent,
          matchStatus: overallMatchStatus,
        },
      }));
    }

    return { id: carrierInvoice.id, matchStatus: overallMatchStatus, autoApproved };
  }
}
