import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ApproveChargePayload {
  chargeId: string;
}

export const APPROVE_CHARGE = 'charge.approve';

export class ApproveChargeCommandHandler extends BaseCommandHandler<ApproveChargePayload, { id: string }> {
  readonly commandType = APPROVE_CHARGE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<ApproveChargePayload>, tx: TransactionClient, emit: EmitFn) {
    const charge = await tx.charge.findUnique({
      where: { id: command.payload.chargeId },
    });

    if (!charge) {
      throw new Error('Charge not found');
    }

    if (charge.status !== 'pending') {
      throw new Error(`Cannot approve charge in status "${charge.status}"`);
    }

    const updated = await tx.charge.update({
      where: { id: charge.id },
      data: {
        status: 'approved',
        approvedBy: command.actorId,
        approvedAt: new Date(),
      },
    });

    // Recalculate shipment summary to reflect the approved charge
    if (charge.shipmentId) {
      await this.recalculateShipmentSummary(tx, charge.shipmentId, command.orgId);
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CHARGE_APPROVED,
      entityType: 'charge',
      entityId: charge.id,
      payload: {
        chargeId: charge.id,
        shipmentId: charge.shipmentId,
        orderId: charge.orderId,
        approvedBy: command.actorId,
      },
    }));

    return { id: updated.id };
  }

  private async recalculateShipmentSummary(tx: TransactionClient, shipmentId: string, orgId: string) {
    const charges = await tx.charge.findMany({
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

    await tx.shipmentFinancialSummary.upsert({
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
