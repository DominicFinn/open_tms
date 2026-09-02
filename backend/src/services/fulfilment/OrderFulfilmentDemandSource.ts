import { PrismaClient } from '@prisma/client';
import type {
  FulfilmentDemandSnapshot,
  IFulfilmentDemandSource,
} from '../../ports/fulfilmentDemand.js';

/**
 * The TMS side of the fulfilment demand port: a TMS Order, flattened into the shape the
 * warehouse needs. This is the only code that reads Order on the warehouse's behalf.
 *
 * Archived and cancelled orders are still returned. The warehouse needs to see the status change
 * to drop them out of wave eligibility, and a snapshot that vanished would leave a stale row.
 */
export class OrderFulfilmentDemandSource implements IFulfilmentDemandSource {
  constructor(private prisma: PrismaClient) {}

  async getSnapshot(orgId: string, sourceId: string): Promise<FulfilmentDemandSnapshot | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: sourceId, orgId },
      include: {
        customer: { select: { id: true, name: true } },
        lineItems: {
          select: {
            id: true,
            sku: true,
            description: true,
            quantity: true,
            unitOfMeasure: true,
            weight: true,
            hazmat: true,
            temperature: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) return null;

    return {
      orgId: order.orgId,
      sourceType: 'tms_order',
      sourceId: order.id,
      orderNumber: order.orderNumber,
      poNumber: order.poNumber,
      status: order.status,
      customerId: order.customerId,
      customerName: order.customer?.name ?? null,
      originLocationId: order.originId,
      serviceLevel: order.serviceLevel,
      temperatureControl: order.temperatureControl,
      hazmat: order.requiresHazmat,
      requestedPickupDate: order.requestedPickupDate,
      requestedDeliveryDate: order.requestedDeliveryDate,
      sourceCreatedAt: order.createdAt,
      lines: order.lineItems.map((line) => ({
        sourceLineId: line.id,
        sku: line.sku,
        description: line.description,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        weight: line.weight,
        hazmat: line.hazmat,
        temperature: line.temperature,
      })),
    };
  }

  async listSourceIds(): Promise<Array<{ orgId: string; sourceId: string }>> {
    const orders = await this.prisma.order.findMany({
      select: { id: true, orgId: true },
      orderBy: { createdAt: 'asc' },
    });
    return orders.map((order) => ({ orgId: order.orgId, sourceId: order.id }));
  }
}
