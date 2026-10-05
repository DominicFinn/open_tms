import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { recalculateShipmentSummary } from './recalculateShipmentSummary.js';

export interface CreateChargePayload {
  shipmentId?: string;
  orderId?: string;
  chargeType: string;
  chargeCategory: 'revenue' | 'cost';
  description: string;
  amountCents: number;
  currency?: string;
  source?: string;
  sourceId?: string;
  accessorialCode?: string;
  freightClass?: string;
  nmfcCode?: string;
  ratedWeight?: number;
  ratePerCwt?: number;
}

export const CREATE_CHARGE = 'charge.create';

export class CreateChargeCommandHandler extends BaseCommandHandler<CreateChargePayload, { id: string }> {
  readonly commandType = CREATE_CHARGE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<CreateChargePayload>, tx: TransactionClient, emit: EmitFn) {
    const { payload } = command;

    if (!payload.shipmentId && !payload.orderId) {
      throw new Error('A charge must be linked to a shipment or order');
    }

    if (payload.shipmentId) {
      const shipment = await tx.shipment.findFirst({
        where: { id: payload.shipmentId, orgId: command.orgId },
        select: { id: true },
      });
      if (!shipment) throw new Error('Shipment not found');
    }
    if (payload.orderId) {
      const order = await tx.order.findFirst({
        where: { id: payload.orderId, orgId: command.orgId },
        select: { id: true },
      });
      if (!order) throw new Error('Order not found');
    }

    // Enforce same-currency on shipment charges
    if (payload.shipmentId) {
      const existing = await tx.charge.findFirst({
        where: { shipmentId: payload.shipmentId, orgId: command.orgId },
        select: { currency: true },
      });
      if (existing && (payload.currency ?? 'USD') !== existing.currency) {
        throw new Error(`All charges on a shipment must use the same currency (existing: ${existing.currency})`);
      }
    }

    const charge = await tx.charge.create({
      data: {
        orgId: command.orgId,
        shipmentId: payload.shipmentId,
        orderId: payload.orderId,
        chargeType: payload.chargeType,
        chargeCategory: payload.chargeCategory,
        description: payload.description,
        amountCents: payload.amountCents,
        currency: payload.currency ?? 'USD',
        source: payload.source ?? 'manual',
        sourceId: payload.sourceId,
        accessorialCode: payload.accessorialCode,
        freightClass: payload.freightClass,
        nmfcCode: payload.nmfcCode,
        ratedWeight: payload.ratedWeight,
        ratePerCwt: payload.ratePerCwt,
        status: 'pending',
        createdBy: command.actorId,
      },
    });

    // Recalculate shipment financial summary
    if (payload.shipmentId) {
      await recalculateShipmentSummary(tx, payload.shipmentId, command.orgId);
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CHARGE_CREATED,
      entityType: 'charge',
      entityId: charge.id,
      payload: {
        chargeId: charge.id,
        shipmentId: payload.shipmentId,
        orderId: payload.orderId,
        chargeType: payload.chargeType,
        chargeCategory: payload.chargeCategory,
        amountCents: payload.amountCents,
        currency: charge.currency,
        source: charge.source,
      },
    }));

    return { id: charge.id };
  }
}
