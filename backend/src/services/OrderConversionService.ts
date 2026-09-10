import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { ICommandBus } from '../commands/CommandBus.js';
import {
  CONVERT_ORDER_TO_SHIPMENT,
  ConvertOrderToShipmentPayload,
  ConvertOrderToShipmentResult,
} from '../commands/orders/ConvertOrderToShipmentCommand.js';
import {
  COMBINE_ORDERS_INTO_SHIPMENT,
  CombineOrdersIntoShipmentPayload,
  CombineOrdersIntoShipmentResult,
} from '../commands/orders/CombineOrdersIntoShipmentCommand.js';
import {
  SPLIT_ORDER,
  SplitOrderPayload,
  SplitOrderResult as SplitOrderCommandResult,
} from '../commands/orders/SplitOrderCommand.js';
import { linkOrdersToShipment } from '../commands/shipments/linkOrdersToShipment.js';

const CONVERSION_SOURCE = 'order-conversion-service';

export interface BatchConvertOptions {
  mode: 'combine' | 'individual';
}

export interface BatchConvertResult {
  success: boolean;
  shipmentIds: string[];
  errors: string[];
  message: string;
}

export interface SplitGroup {
  trackableUnitIds: string[];
  legacyItemIds: string[];
}

export interface SplitOrderResult {
  success: boolean;
  shipmentIds: string[];
  errors: string[];
  message: string;
}

export interface CompatibilityCheck {
  compatible: boolean;
  warnings: string[];
  errors: string[];
  orders: {
    id: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    originId: string | null;
    originName: string;
    destinationId: string | null;
    destinationName: string;
    serviceLevel: string;
    temperatureControl: string;
    requiresHazmat: boolean;
    status: string;
  }[];
}

export interface IOrderConversionService {
  checkCompatibility(orderIds: string[]): Promise<CompatibilityCheck>;
  batchConvert(orderIds: string[], options: BatchConvertOptions, userId?: string): Promise<BatchConvertResult>;
  /** Manually convert a single order into a brand-new shipment. */
  convertOrder(orderId: string, userId?: string): Promise<{ shipmentId: string }>;
  splitOrder(orderId: string, groups: SplitGroup[], userId?: string): Promise<SplitOrderResult>;
  /**
   * Manually add order(s) to an existing shipment, rather than creating a
   * new one. Requires matching origin + customer with the target shipment,
   * and the shipment must not have already left draft/ready.
   */
  addOrdersToShipment(orgId: string, shipmentId: string, orderIds: string[], userId?: string): Promise<BatchConvertResult>;
  /**
   * Unlink a single order from a shipment — reverses linkOrdersToShipment.
   * Requires the shipment to still be draft/ready, mirroring addOrdersToShipment.
   */
  removeOrderFromShipment(
    orgId: string,
    shipmentId: string,
    orderId: string,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }>;
}

export class OrderConversionService implements IOrderConversionService {
  constructor(private prisma: PrismaClient, private commandBus: ICommandBus) {}

  async checkCompatibility(orderIds: string[]): Promise<CompatibilityCheck> {
    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, archived: false },
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
      },
    });

    const warnings: string[] = [];
    const errors: string[] = [];

    // Check all orders exist
    if (orders.length !== orderIds.length) {
      const foundIds = new Set(orders.map((o) => o.id));
      const missing = orderIds.filter((id) => !foundIds.has(id));
      errors.push(`Orders not found: ${missing.join(', ')}`);
    }

    // Check no orders are already assigned to a shipment
    const alreadyConverted = orders.filter(
      (o) => o.status === 'assigned'
    );
    if (alreadyConverted.length > 0) {
      errors.push(
        `Orders already converted/assigned: ${alreadyConverted.map((o) => o.orderNumber).join(', ')}`
      );
    }

    // Check all have valid locations
    const missingLocations = orders.filter((o) => !o.originId || !o.destinationId);
    if (missingLocations.length > 0) {
      errors.push(
        `Orders missing origin/destination: ${missingLocations.map((o) => o.orderNumber).join(', ')}`
      );
    }

    // Check customer consistency
    const customerIds = new Set(orders.map((o) => o.customerId));
    if (customerIds.size > 1) {
      warnings.push(
        'Orders belong to different customers. Combined shipment will use the first order\'s customer.'
      );
    }

    // Check origin consistency
    const originIds = new Set(orders.filter((o) => o.originId).map((o) => o.originId));
    if (originIds.size > 1) {
      errors.push(
        'Orders have different origins. Cannot combine into a single shipment.'
      );
    }

    // Check destination consistency
    const destinationIds = new Set(orders.filter((o) => o.destinationId).map((o) => o.destinationId));
    if (destinationIds.size > 1) {
      warnings.push(
        'Orders have different destinations. A delivery stop will be created for each destination.'
      );
    }

    // Check service level mix
    const serviceLevels = new Set(orders.map((o) => o.serviceLevel));
    if (serviceLevels.size > 1) {
      warnings.push('Orders have mixed service levels (FTL/LTL). Shipment will default to FTL.');
    }

    // Check temperature control mix
    const tempControls = new Set(orders.map((o) => o.temperatureControl));
    if (tempControls.size > 1) {
      warnings.push(
        'Orders have mixed temperature requirements. Shipment will use the strictest requirement.'
      );
    }

    const compatible = errors.length === 0;

    return {
      compatible,
      warnings,
      errors,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: o.customer.name,
        originId: o.originId,
        originName: o.origin
          ? `${o.origin.name} (${o.origin.city}, ${o.origin.state || ''})`
          : 'Unknown',
        destinationId: o.destinationId,
        destinationName: o.destination
          ? `${o.destination.name} (${o.destination.city}, ${o.destination.state || ''})`
          : 'Unknown',
        serviceLevel: o.serviceLevel,
        temperatureControl: o.temperatureControl,
        requiresHazmat: o.requiresHazmat,
        status: o.status,
      })),
    };
  }

  async batchConvert(
    orderIds: string[],
    options: BatchConvertOptions,
    userId?: string
  ): Promise<BatchConvertResult> {
    if (orderIds.length === 0) {
      return { success: false, shipmentIds: [], errors: ['No orders specified'], message: 'No orders specified' };
    }

    if (options.mode === 'individual') {
      return this.convertIndividually(orderIds, userId);
    }

    return this.combineIntoShipment(orderIds, userId);
  }

  private async convertIndividually(orderIds: string[], userId?: string): Promise<BatchConvertResult> {
    const shipmentIds: string[] = [];
    const errors: string[] = [];

    for (const orderId of orderIds) {
      try {
        const result = await this.convertOrder(orderId, userId);
        shipmentIds.push(result.shipmentId);
      } catch (err: any) {
        errors.push(`Order ${orderId}: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      shipmentIds,
      errors,
      message:
        errors.length === 0
          ? `Successfully created ${shipmentIds.length} shipment(s)`
          : `Created ${shipmentIds.length} shipment(s) with ${errors.length} error(s)`,
    };
  }

  /** Manually convert a single order into a brand-new shipment. */
  async convertOrder(orderId: string, userId?: string): Promise<{ shipmentId: string }> {
    // Only need orgId to populate the command envelope — CONVERT_ORDER_TO_SHIPMENT
    // re-reads the order (with all the includes it needs) inside its own transaction.
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orgId: true },
    });
    if (!order) throw new Error('Order not found');

    const result = await this.commandBus.dispatch<ConvertOrderToShipmentPayload, ConvertOrderToShipmentResult>({
      type: CONVERT_ORDER_TO_SHIPMENT,
      orgId: order.orgId,
      actorId: userId ?? null,
      payload: { orderId },
      metadata: { correlationId: randomUUID(), source: CONVERSION_SOURCE },
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to convert order to shipment');
    }

    return { shipmentId: result.data.shipmentId };
  }

  private async combineIntoShipment(orderIds: string[], userId?: string): Promise<BatchConvertResult> {
    // Validate compatibility first. This was already a soft pre-check run
    // outside any transaction before the write moved onto the command bus,
    // so this doesn't weaken anything — COMBINE_ORDERS_INTO_SHIPMENT re-reads
    // the orders fresh inside its own transaction.
    const check = await this.checkCompatibility(orderIds);
    if (!check.compatible) {
      return {
        success: false,
        shipmentIds: [],
        errors: check.errors,
        message: 'Orders are not compatible for combining',
      };
    }

    const orgLookup = await this.prisma.order.findFirst({
      where: { id: { in: orderIds }, archived: false },
      select: { orgId: true },
    });
    if (!orgLookup) {
      return { success: false, shipmentIds: [], errors: ['No valid orders found'], message: 'No valid orders found' };
    }

    const result = await this.commandBus.dispatch<CombineOrdersIntoShipmentPayload, CombineOrdersIntoShipmentResult>({
      type: COMBINE_ORDERS_INTO_SHIPMENT,
      orgId: orgLookup.orgId,
      actorId: userId ?? null,
      payload: { orderIds },
      metadata: { correlationId: randomUUID(), source: CONVERSION_SOURCE },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        shipmentIds: [],
        errors: [result.error || 'Failed to combine orders'],
        message: 'Failed to combine orders',
      };
    }

    return {
      success: true,
      shipmentIds: [result.data.shipmentId],
      errors: [],
      message: `Successfully combined ${orderIds.length} orders into 1 shipment`,
    };
  }

  async splitOrder(orderId: string, groups: SplitGroup[], userId?: string): Promise<SplitOrderResult> {
    // Only need orgId to populate the command envelope — SPLIT_ORDER validates
    // everything else (group count, unit/item coverage, order status/locations)
    // against a fresh read inside its own transaction.
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orgId: true },
    });
    if (!order) {
      return { success: false, shipmentIds: [], errors: ['Order not found'], message: 'Order not found' };
    }

    const result = await this.commandBus.dispatch<SplitOrderPayload, SplitOrderCommandResult>({
      type: SPLIT_ORDER,
      orgId: order.orgId,
      actorId: userId ?? null,
      payload: { orderId, groups },
      metadata: { correlationId: randomUUID(), source: CONVERSION_SOURCE },
    });

    if (!result.success || !result.data) {
      const message = result.error || 'Failed to split order';
      return { success: false, shipmentIds: [], errors: [message], message };
    }

    return {
      success: true,
      shipmentIds: result.data.shipmentIds,
      errors: [],
      message: `Successfully split order into ${result.data.shipmentIds.length} shipments`,
    };
  }

  async addOrdersToShipment(
    orgId: string,
    shipmentId: string,
    orderIds: string[],
    userId?: string
  ): Promise<BatchConvertResult> {
    if (orderIds.length === 0) {
      return { success: false, shipmentIds: [], errors: ['No orders specified'], message: 'No orders specified' };
    }

    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId, deletedAt: null },
    });
    if (!shipment) {
      return { success: false, shipmentIds: [], errors: ['Shipment not found'], message: 'Shipment not found' };
    }
    if (shipment.status === 'in_progress' || shipment.status === 'complete') {
      return {
        success: false,
        shipmentIds: [],
        errors: [`Shipment is already ${shipment.status} — orders can only be added while it's draft or ready`],
        message: 'Shipment has already left draft/ready',
      };
    }
    if (!shipment.originId) {
      return { success: false, shipmentIds: [], errors: ['Shipment has no origin set'], message: 'Shipment has no origin set' };
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, orgId, archived: false },
      include: {
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });

    const errors: string[] = [];
    const found = new Set(orders.map((o) => o.id));
    for (const id of orderIds) {
      if (!found.has(id)) errors.push(`Order ${id} not found`);
    }

    const valid = orders.filter((o) => {
      if (o.status === 'assigned') {
        errors.push(`${o.orderNumber} is already ${o.status}`);
        return false;
      }
      if (!o.originId || !o.destinationId) {
        errors.push(`${o.orderNumber} is missing origin or destination`);
        return false;
      }
      if (o.originId !== shipment.originId) {
        errors.push(`${o.orderNumber} has a different origin than this shipment`);
        return false;
      }
      if (o.customerId !== shipment.customerId) {
        errors.push(`${o.orderNumber} belongs to a different customer than this shipment`);
        return false;
      }
      if (shipment.serviceLevel && o.serviceLevel !== shipment.serviceLevel) {
        errors.push(`${o.orderNumber} is ${o.serviceLevel} but this shipment is ${shipment.serviceLevel}`);
        return false;
      }
      if (o.requiresHazmat && !shipment.hazmat) {
        errors.push(`${o.orderNumber} requires hazmat handling, which this shipment isn't flagged for`);
        return false;
      }
      if (o.temperatureControl !== 'ambient' && !shipment.tempControlled) {
        errors.push(`${o.orderNumber} requires temperature control, which this shipment isn't flagged for`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) {
      return {
        success: false,
        shipmentIds: [],
        errors: errors.length ? errors : ['No valid orders to add'],
        message: 'No valid orders to add',
      };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // NOTE: this path still doesn't dispatch through the command bus, so
        // it intentionally emits nothing — it only ever links orders to an
        // *existing* shipment, so it's outside the SHIPMENT_CREATED gap this
        // module was extracted to fix (#264). ORDER_ASSIGNED_TO_SHIPMENT stays
        // dark for manual add-to-shipment until that's addressed separately.
        await linkOrdersToShipment(
          tx,
          shipment,
          valid,
          { orgId, actorId: userId ?? null },
          () => `Order manually added to shipment ${shipment.reference}`,
          () => {},
        );
      });
    } catch (err: any) {
      return { success: false, shipmentIds: [], errors: [err.message], message: 'Failed to add orders to shipment' };
    }

    return {
      success: errors.length === 0,
      shipmentIds: [shipmentId],
      errors,
      message:
        errors.length === 0
          ? `Added ${valid.length} order${valid.length === 1 ? '' : 's'} to shipment ${shipment.reference}`
          : `Added ${valid.length} order${valid.length === 1 ? '' : 's'}, ${errors.length} skipped`,
    };
  }

  async removeOrderFromShipment(
    orgId: string,
    shipmentId: string,
    orderId: string,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId, deletedAt: null } });
    if (!shipment) return { success: false, error: 'Shipment not found' };
    if (shipment.status === 'in_progress' || shipment.status === 'complete') {
      return {
        success: false,
        error: `Shipment is already ${shipment.status} — orders can only be removed while it's draft or ready`,
      };
    }

    const link = await this.prisma.orderShipment.findFirst({ where: { shipmentId, orderId } });
    if (!link) return { success: false, error: 'Order is not linked to this shipment' };

    const order = await this.prisma.order.findFirst({ where: { id: orderId, orgId } });
    if (!order) return { success: false, error: 'Order not found' };

    await this.prisma.$transaction(async (tx) => {
      await tx.orderShipment.delete({ where: { id: link.id } });

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'verified', deliveryStopId: null },
      });

      const items = Array.isArray(shipment.items) ? (shipment.items as any[]) : [];
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { items: items.filter((it: any) => it.orderId !== orderId) },
      });

      // Best-effort: drop the delivery stop if this was its only order.
      if (order.deliveryStopId) {
        const stillUsed = await tx.order.count({
          where: { deliveryStopId: order.deliveryStopId, id: { not: orderId } },
        });
        if (stillUsed === 0) {
          await tx.shipmentStop.delete({ where: { id: order.deliveryStopId } }).catch(() => {});
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          orderId,
          action: 'delivery_status_changed',
          description: `Order removed from shipment ${shipment.reference}`,
          changes: { before: { status: order.status }, after: { status: 'verified' } },
          userId,
        },
      });
    });

    return { success: true };
  }

}
