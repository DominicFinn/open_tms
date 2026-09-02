/**
 * WmsFulfilmentOrderProjection — builds WmsFulfilmentOrder from the demand that TMS orders
 * represent, so warehouse code never reads a TMS table.
 *
 * The projection takes a whole snapshot through IFulfilmentDemandSource on every event rather
 * than patching fields from event payloads. Order and line events arrive independently and can
 * interleave, and a wave built from a half-applied order picks the wrong stock. Re-projecting
 * the whole order is idempotent and costs one query.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import type {
  FulfilmentDemandSnapshot,
  IFulfilmentDemandSource,
} from '../../ports/fulfilmentDemand.js';

const SOURCE_TYPE = 'tms_order';

export class WmsFulfilmentOrderProjection implements IEventHandler {
  readonly name = 'projection.wms_fulfilment_order';
  readonly eventPatterns = ['order.*', 'order_line_item.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(
    private prisma: PrismaClient,
    private demandSource: IFulfilmentDemandSource
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case EVENT_TYPES.ORDER_DELETED:
        return this.remove(event.orgId, event.entityId);

      case EVENT_TYPES.ORDER_LINE_ITEM_CREATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_UPDATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_DELETED: {
        // Line events carry the line's own id as entityId, so the order comes from the payload.
        const orderId = (event.payload as { orderId?: string })?.orderId;
        if (!orderId) return;
        return this.project(event.orgId, orderId);
      }

      case EVENT_TYPES.ORDER_CREATED:
      case EVENT_TYPES.ORDER_UPDATED:
      case EVENT_TYPES.ORDER_STATUS_CHANGED:
      case EVENT_TYPES.ORDER_ARCHIVED:
      case EVENT_TYPES.ORDER_UNARCHIVED:
        return this.project(event.orgId, event.entityId);

      default:
        // Delivery, exception and shipment-assignment events don't change what the warehouse
        // has to pick.
        break;
    }
  }

  /** Re-reads the demand and writes the whole order and its lines. */
  async project(orgId: string, sourceId: string): Promise<void> {
    const snapshot = await this.demandSource.getSnapshot(orgId, sourceId);
    if (!snapshot) {
      await this.remove(orgId, sourceId);
      return;
    }

    await this.write(snapshot);
  }

  private async write(snapshot: FulfilmentDemandSnapshot): Promise<void> {
    const totalQuantity = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
    const fields = {
      orderNumber: snapshot.orderNumber,
      poNumber: snapshot.poNumber,
      status: snapshot.status,
      customerId: snapshot.customerId,
      customerName: snapshot.customerName,
      originLocationId: snapshot.originLocationId,
      serviceLevel: snapshot.serviceLevel,
      temperatureControl: snapshot.temperatureControl,
      hazmat: snapshot.hazmat,
      requestedPickupDate: snapshot.requestedPickupDate,
      requestedDeliveryDate: snapshot.requestedDeliveryDate,
      lineCount: snapshot.lines.length,
      totalQuantity,
      sourceCreatedAt: snapshot.sourceCreatedAt,
    };

    const order = await this.prisma.wmsFulfilmentOrder.upsert({
      where: {
        orgId_sourceType_sourceId: {
          orgId: snapshot.orgId,
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
        },
      },
      create: {
        orgId: snapshot.orgId,
        sourceType: snapshot.sourceType,
        sourceId: snapshot.sourceId,
        ...fields,
      },
      update: fields,
      select: { id: true },
    });

    // Replace the lines wholesale. They are a projection of the source, and a line removed
    // upstream has to disappear here or the wave allocates against stock nobody ordered.
    await this.prisma.$transaction([
      this.prisma.wmsFulfilmentOrderLine.deleteMany({ where: { fulfilmentOrderId: order.id } }),
      this.prisma.wmsFulfilmentOrderLine.createMany({
        data: snapshot.lines.map((line) => ({
          fulfilmentOrderId: order.id,
          orgId: snapshot.orgId,
          sourceLineId: line.sourceLineId,
          sku: line.sku,
          description: line.description,
          quantity: line.quantity,
          unitOfMeasure: line.unitOfMeasure,
          weight: line.weight,
          hazmat: line.hazmat,
          temperature: line.temperature,
        })),
      }),
    ]);
  }

  private async remove(orgId: string, sourceId: string): Promise<void> {
    await this.prisma.wmsFulfilmentOrder.deleteMany({
      where: { orgId, sourceType: SOURCE_TYPE, sourceId },
    });
  }
}
