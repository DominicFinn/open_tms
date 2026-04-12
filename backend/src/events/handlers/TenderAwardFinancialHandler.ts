/**
 * TenderAwardFinancialHandler — when a tender is awarded, automatically creates
 * an expected-cost Charge on the shipment from the winning bid rate.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class TenderAwardFinancialHandler implements IEventHandler {
  readonly name = 'tender_award_financial';
  readonly eventPatterns = [EVENT_TYPES.TENDER_AWARDED];
  readonly options = { concurrency: 2, retryLimit: 3, expireInSeconds: 60 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== EVENT_TYPES.TENDER_AWARDED) return;

    const payload = event.payload as {
      bidId: string;
      carrierId: string;
      rate: number;
    };

    if (!payload.bidId || !payload.rate) return;

    try {
      // Get the tender and shipment
      const tender = await this.prisma.tender.findUnique({
        where: { id: event.entityId },
        select: {
          id: true,
          shipmentId: true,
          currency: true,
        },
      });

      if (!tender?.shipmentId) return;

      // Check if a cost charge already exists from this tender (idempotency)
      const existingCharge = await this.prisma.charge.findFirst({
        where: {
          shipmentId: tender.shipmentId,
          source: 'tender_bid',
          sourceId: payload.bidId,
        },
      });

      if (existingCharge) return;

      // Get the bid for full details
      const bid = await this.prisma.tenderBid.findUnique({
        where: { id: payload.bidId },
        select: {
          id: true,
          rate: true,
          currency: true,
          carrier: { select: { name: true } },
        },
      });

      if (!bid) return;

      // Convert rate (Float in dollars) to cents
      const rateCents = Math.round(bid.rate * 100);
      const currency = bid.currency ?? tender.currency ?? 'USD';

      // Create the expected cost charge
      await this.prisma.charge.create({
        data: {
          orgId: event.orgId,
          shipmentId: tender.shipmentId,
          chargeType: 'linehaul',
          chargeCategory: 'cost',
          description: `Linehaul — ${bid.carrier.name} (tender award)`,
          amountCents: rateCents,
          currency,
          source: 'tender_bid',
          sourceId: bid.id,
          status: 'approved', // Tender-awarded rates are pre-approved
          approvedBy: event.actorId ?? 'system',
          approvedAt: new Date(),
        },
      });

      // Recalculate shipment financial summary
      await this.recalculateShipmentSummary(tender.shipmentId, event.orgId);

      console.log(
        `[${this.name}] Created cost charge for shipment ${tender.shipmentId}: ` +
        `${rateCents}c ${currency} from tender bid ${bid.id}`
      );
    } catch (err) {
      console.error(`[${this.name}] Error processing tender award:`, err);
      throw err;
    }
  }

  private async recalculateShipmentSummary(shipmentId: string, orgId: string) {
    const charges = await this.prisma.charge.findMany({
      where: { shipmentId, status: { not: 'written_off' } },
    });

    const revenueCents = charges
      .filter(c => c.chargeCategory === 'revenue')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const costCents = charges
      .filter(c => c.chargeCategory === 'cost')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const approvedRevenue = charges
      .filter(c => c.chargeCategory === 'revenue' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const approvedCost = charges
      .filter(c => c.chargeCategory === 'cost' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const currency = charges.length > 0 ? charges[0].currency : 'USD';

    await this.prisma.shipmentFinancialSummary.upsert({
      where: { shipmentId },
      create: {
        shipmentId,
        orgId,
        expectedRevenueCents: revenueCents,
        expectedCostCents: costCents,
        expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue,
        actualCostCents: approvedCost,
        actualMarginCents: approvedRevenue - approvedCost,
        currency,
      },
      update: {
        expectedRevenueCents: revenueCents,
        expectedCostCents: costCents,
        expectedMarginCents: revenueCents - costCents,
        actualRevenueCents: approvedRevenue,
        actualCostCents: approvedCost,
        actualMarginCents: approvedRevenue - approvedCost,
        currency,
      },
    });
  }
}
