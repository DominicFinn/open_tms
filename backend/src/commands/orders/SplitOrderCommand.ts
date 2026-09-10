/**
 * SplitOrderCommand — splits one order's trackable units/line items across
 * multiple new draft shipments and emits SHIPMENT_CREATED for each.
 *
 * Extracted from OrderConversionService.splitOrder (#264). Does not emit
 * ORDER_ASSIGNED_TO_SHIPMENT: that event's schema is one order -> one
 * shipment, and a split fans one order out across several — forcing it in
 * would mean picking a "winning" shipment for OrderReadModel.shipmentId
 * with no principled way to choose. Left for a follow-up if that read model
 * field turns out to matter for split orders.
 *
 * All validation (group count, unit/item coverage, duplicate assignment,
 * empty groups) now runs inside the transaction against a freshly re-read
 * order, rather than against a snapshot read before a $transaction was
 * opened as the original service method did.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SplitGroupPayload {
  trackableUnitIds: string[];
  legacyItemIds: string[];
}

export interface SplitOrderPayload {
  orderId: string;
  groups: SplitGroupPayload[];
}

export interface SplitOrderResult {
  shipmentIds: string[];
}

export const SPLIT_ORDER = 'order.split';

export class SplitOrderCommandHandler extends BaseCommandHandler<SplitOrderPayload, SplitOrderResult> {
  readonly commandType = SPLIT_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SplitOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<SplitOrderResult> {
    const { orderId, groups } = command.payload;

    if (groups.length < 2) {
      throw new Error('At least 2 groups are required to split an order');
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'assigned') {
      throw new Error(`Order already ${order.status}`);
    }
    if (!order.originId || !order.destinationId) {
      throw new Error('Order missing origin or destination');
    }

    // Validate all units/items are accounted for
    const allUnitIds = new Set(order.trackableUnits.map((u) => u.id));
    const allLegacyIds = new Set(order.lineItems.map((i) => i.id));
    const assignedUnitIds = new Set<string>();
    const assignedLegacyIds = new Set<string>();

    for (const group of groups) {
      for (const uid of group.trackableUnitIds) {
        if (!allUnitIds.has(uid)) {
          throw new Error(`Trackable unit ${uid} not found in this order`);
        }
        if (assignedUnitIds.has(uid)) {
          throw new Error(`Trackable unit ${uid} assigned to multiple groups`);
        }
        assignedUnitIds.add(uid);
      }
      for (const lid of group.legacyItemIds) {
        if (!allLegacyIds.has(lid)) {
          throw new Error(`Line item ${lid} not found in this order`);
        }
        if (assignedLegacyIds.has(lid)) {
          throw new Error(`Line item ${lid} assigned to multiple groups`);
        }
        assignedLegacyIds.add(lid);
      }
    }

    for (let i = 0; i < groups.length; i++) {
      if (groups[i].trackableUnitIds.length === 0 && groups[i].legacyItemIds.length === 0) {
        throw new Error(`Group ${i + 1} is empty`);
      }
    }

    const ids: string[] = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const reference = `SH-${order.orderNumber}-${i + 1}`;

      const groupUnits = order.trackableUnits.filter((u) => group.trackableUnitIds.includes(u.id));
      const groupLegacyItems = order.lineItems.filter((li) => group.legacyItemIds.includes(li.id));

      const items: any[] = [{
        orderId: order.id,
        orderNumber: order.orderNumber,
        splitGroup: i + 1,
        trackableUnits: groupUnits.map((unit) => ({
          unitId: unit.id,
          identifier: unit.identifier,
          unitType: unit.unitType,
          items: unit.lineItems.map((item) => ({
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            weight: item.weight,
            weightUnit: item.weightUnit,
          })),
        })),
        legacyItems: groupLegacyItems.map((item) => ({
          itemId: item.id,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit,
        })),
      }];

      const shipment = await tx.shipment.create({
        data: {
          orgId: order.orgId,
          reference,
          customerId: order.customerId,
          originId: order.originId!,
          destinationId: order.destinationId!,
          pickupDate: order.requestedPickupDate || undefined,
          deliveryDate: order.requestedDeliveryDate || undefined,
          items,
          status: 'draft',
        },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.SHIPMENT_CREATED,
        entityType: 'shipment',
        entityId: shipment.id,
        orgId: order.orgId,
        payload: {
          shipmentReference: reference,
          customerId: order.customerId,
          originId: order.originId,
          destinationId: order.destinationId,
          status: 'draft',
        },
      }));

      await tx.orderShipment.create({
        data: { orderId: order.id, shipmentId: shipment.id },
      });

      await tx.shipmentStop.create({
        data: {
          shipmentId: shipment.id,
          locationId: order.destinationId!,
          sequenceNumber: 1,
          stopType: 'delivery',
          status: 'pending',
        },
      });

      ids.push(shipment.id);
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'assigned' },
    });

    await tx.auditLog.create({
      data: {
        entityType: 'order',
        entityId: orderId,
        orderId,
        action: 'delivery_status_changed',
        description: `Order split into ${groups.length} shipments`,
        changes: {
          before: { status: order.status },
          after: { status: 'assigned' },
          splitShipmentIds: ids,
          splitGroups: groups.length,
        },
        userId: command.actorId ?? undefined,
      },
    });

    return { shipmentIds: ids };
  }
}
