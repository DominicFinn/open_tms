/**
 * ConsolidationBillingService — pro-rates LTL shipment costs across multiple
 * orders based on each order's share of total shipment weight.
 *
 * When multiple orders share a single LTL shipment, the carrier charges one
 * rate for the whole shipment. This service splits that cost fairly.
 */

import { PrismaClient } from '@prisma/client';

export interface ProRateResult {
  orderId: string;
  orderNumber: string;
  weightKg: number;
  weightPercent: number;
  allocatedCostCents: number;
  allocatedRevenueCents: number;
}

export interface ConsolidationResult {
  shipmentId: string;
  totalWeightKg: number;
  totalCostCents: number;
  totalRevenueCents: number;
  orderAllocations: ProRateResult[];
}

export interface IConsolidationBillingService {
  proRateCostsByWeight(shipmentId: string, markupPercent?: number): Promise<ConsolidationResult>;
}

export class ConsolidationBillingService implements IConsolidationBillingService {
  constructor(private prisma: PrismaClient) {}

  async proRateCostsByWeight(shipmentId: string, markupPercent: number = 15): Promise<ConsolidationResult> {
    // Get all orders on this shipment with their weights
    const orderShipments = await this.prisma.orderShipment.findMany({
      where: { shipmentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            lineItems: {
              select: { weight: true, quantity: true },
            },
          },
        },
      },
    });

    if (orderShipments.length === 0) {
      throw new Error('No orders found on this shipment');
    }

    // Calculate weight per order
    const orderWeights = orderShipments.map(os => {
      const totalWeight = os.order.lineItems.reduce((sum, li) => {
        return sum + ((li.weight ?? 0) * li.quantity);
      }, 0);
      return {
        orderId: os.order.id,
        orderNumber: os.order.orderNumber,
        weightKg: totalWeight,
      };
    });

    const totalWeightKg = orderWeights.reduce((s, o) => s + o.weightKg, 0);

    if (totalWeightKg === 0) {
      throw new Error('Total weight is zero — cannot pro-rate');
    }

    // Get total shipment cost charges
    const costCharges = await this.prisma.charge.findMany({
      where: {
        shipmentId,
        chargeCategory: 'cost',
        status: { not: 'written_off' },
      },
    });

    const totalCostCents = costCharges.reduce((s, c) => s + c.amountCents, 0);
    const totalRevenueCents = Math.round(totalCostCents * (1 + markupPercent / 100));

    // Pro-rate across orders by weight percentage
    const orderAllocations: ProRateResult[] = orderWeights.map(ow => {
      const weightPercent = Math.round((ow.weightKg / totalWeightKg) * 10000) / 100;
      const allocatedCostCents = Math.round(totalCostCents * ow.weightKg / totalWeightKg);
      const allocatedRevenueCents = Math.round(totalRevenueCents * ow.weightKg / totalWeightKg);

      return {
        orderId: ow.orderId,
        orderNumber: ow.orderNumber,
        weightKg: ow.weightKg,
        weightPercent,
        allocatedCostCents,
        allocatedRevenueCents,
      };
    });

    return {
      shipmentId,
      totalWeightKg,
      totalCostCents,
      totalRevenueCents,
      orderAllocations,
    };
  }
}
