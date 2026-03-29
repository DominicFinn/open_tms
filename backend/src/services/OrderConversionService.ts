import { PrismaClient } from '@prisma/client';

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
  batchConvert(orderIds: string[], options: BatchConvertOptions): Promise<BatchConvertResult>;
  splitOrder(orderId: string, groups: SplitGroup[]): Promise<SplitOrderResult>;
}

export class OrderConversionService implements IOrderConversionService {
  constructor(private prisma: PrismaClient) {}

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

    // Check no orders are already converted/assigned
    const alreadyConverted = orders.filter(
      (o) => o.status === 'converted' || o.status === 'assigned'
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
    options: BatchConvertOptions
  ): Promise<BatchConvertResult> {
    if (orderIds.length === 0) {
      return { success: false, shipmentIds: [], errors: ['No orders specified'], message: 'No orders specified' };
    }

    if (options.mode === 'individual') {
      return this.convertIndividually(orderIds);
    }

    return this.combineIntoShipment(orderIds);
  }

  private async convertIndividually(orderIds: string[]): Promise<BatchConvertResult> {
    const shipmentIds: string[] = [];
    const errors: string[] = [];

    for (const orderId of orderIds) {
      try {
        const result = await this.convertSingleOrder(orderId);
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

  private async convertSingleOrder(orderId: string): Promise<{ shipmentId: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });

    if (!order) throw new Error('Order not found');
    if (order.status === 'converted' || order.status === 'assigned') {
      throw new Error(`Order already ${order.status}`);
    }
    if (!order.originId || !order.destinationId) {
      throw new Error('Order missing origin or destination');
    }

    return this.prisma.$transaction(async (tx) => {
      const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
      const reference = `SH-${order.orderNumber}`;

      const items = this.buildItemsPayload([order]);

      const shipment = await tx.shipment.create({
        data: {
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

      await tx.orderShipment.create({
        data: { orderId: order.id, shipmentId: shipment.id },
      });

      const deliveryStop = await tx.shipmentStop.create({
        data: {
          shipmentId: shipment.id,
          locationId: order.destinationId!,
          sequenceNumber: 1,
          stopType: 'delivery',
          status: 'pending',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'converted',
          deliveryStatus: 'assigned',
          deliveryStopId: deliveryStop.id,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: 'order',
          entityId: orderId,
          orderId,
          action: 'delivery_status_changed',
          description: `Order converted to shipment ${reference}`,
          changes: {
            before: { deliveryStatus: order.deliveryStatus, status: order.status },
            after: { deliveryStatus: 'assigned', status: 'converted' },
          },
        },
      });

      return { shipmentId: shipment.id };
    });
  }

  private async combineIntoShipment(orderIds: string[]): Promise<BatchConvertResult> {
    // Validate compatibility first
    const check = await this.checkCompatibility(orderIds);
    if (!check.compatible) {
      return {
        success: false,
        shipmentIds: [],
        errors: check.errors,
        message: 'Orders are not compatible for combining',
      };
    }

    const orders = await this.prisma.order.findMany({
      where: { id: { in: orderIds }, archived: false },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      return { success: false, shipmentIds: [], errors: ['No valid orders found'], message: 'No valid orders found' };
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const firstOrder = orders[0];
        const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
        const reference = `SH-BATCH-${timestamp}`;

        // Use first order's origin; strictest temp control
        const tempPriority: Record<string, number> = { frozen: 3, refrigerated: 2, ambient: 1 };
        const strictestTemp = orders.reduce((strictest, o) =>
          (tempPriority[o.temperatureControl] || 0) > (tempPriority[strictest] || 0)
            ? o.temperatureControl
            : strictest,
          'ambient'
        );

        const items = this.buildItemsPayload(orders);

        const shipment = await tx.shipment.create({
          data: {
            reference,
            customerId: firstOrder.customerId,
            originId: firstOrder.originId!,
            destinationId: firstOrder.destinationId!,
            items,
            status: 'draft',
          },
        });

        // Create delivery stops for each unique destination
        const destinationMap = new Map<string, string[]>();
        for (const order of orders) {
          if (!order.destinationId) continue;
          const existing = destinationMap.get(order.destinationId) || [];
          existing.push(order.id);
          destinationMap.set(order.destinationId, existing);
        }

        let stopSeq = 1;
        const stopMap = new Map<string, string>(); // destinationId -> stopId

        for (const [destId] of destinationMap) {
          const stop = await tx.shipmentStop.create({
            data: {
              shipmentId: shipment.id,
              locationId: destId,
              sequenceNumber: stopSeq++,
              stopType: 'delivery',
              status: 'pending',
            },
          });
          stopMap.set(destId, stop.id);
        }

        // Link each order and update status
        for (const order of orders) {
          await tx.orderShipment.create({
            data: { orderId: order.id, shipmentId: shipment.id },
          });

          const stopId = order.destinationId ? stopMap.get(order.destinationId) : undefined;

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'converted',
              deliveryStatus: 'assigned',
              deliveryStopId: stopId || undefined,
            },
          });

          await tx.auditLog.create({
            data: {
              entityType: 'order',
              entityId: order.id,
              orderId: order.id,
              action: 'delivery_status_changed',
              description: `Order combined into batch shipment ${reference} with ${orders.length} orders`,
              changes: {
                before: { deliveryStatus: order.deliveryStatus, status: order.status },
                after: { deliveryStatus: 'assigned', status: 'converted' },
                batchOrderIds: orderIds,
              },
            },
          });
        }

        return shipment.id;
      });

      return {
        success: true,
        shipmentIds: [result],
        errors: [],
        message: `Successfully combined ${orders.length} orders into 1 shipment`,
      };
    } catch (err: any) {
      return {
        success: false,
        shipmentIds: [],
        errors: [err.message],
        message: 'Failed to combine orders',
      };
    }
  }

  async splitOrder(orderId: string, groups: SplitGroup[]): Promise<SplitOrderResult> {
    if (groups.length < 2) {
      return {
        success: false,
        shipmentIds: [],
        errors: ['At least 2 groups are required to split an order'],
        message: 'Invalid split configuration',
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: { where: { trackableUnitId: null } },
      },
    });

    if (!order) {
      return { success: false, shipmentIds: [], errors: ['Order not found'], message: 'Order not found' };
    }

    if (order.status === 'converted' || order.status === 'assigned') {
      return {
        success: false,
        shipmentIds: [],
        errors: [`Order already ${order.status}`],
        message: `Order already ${order.status}`,
      };
    }

    if (!order.originId || !order.destinationId) {
      return {
        success: false,
        shipmentIds: [],
        errors: ['Order missing origin or destination'],
        message: 'Order missing locations',
      };
    }

    // Validate all units/items are accounted for
    const allUnitIds = new Set(order.trackableUnits.map((u) => u.id));
    const allLegacyIds = new Set(order.lineItems.map((i) => i.id));
    const assignedUnitIds = new Set<string>();
    const assignedLegacyIds = new Set<string>();

    for (const group of groups) {
      for (const uid of group.trackableUnitIds) {
        if (!allUnitIds.has(uid)) {
          return {
            success: false,
            shipmentIds: [],
            errors: [`Trackable unit ${uid} not found in this order`],
            message: 'Invalid split configuration',
          };
        }
        if (assignedUnitIds.has(uid)) {
          return {
            success: false,
            shipmentIds: [],
            errors: [`Trackable unit ${uid} assigned to multiple groups`],
            message: 'Invalid split configuration',
          };
        }
        assignedUnitIds.add(uid);
      }
      for (const lid of group.legacyItemIds) {
        if (!allLegacyIds.has(lid)) {
          return {
            success: false,
            shipmentIds: [],
            errors: [`Line item ${lid} not found in this order`],
            message: 'Invalid split configuration',
          };
        }
        if (assignedLegacyIds.has(lid)) {
          return {
            success: false,
            shipmentIds: [],
            errors: [`Line item ${lid} assigned to multiple groups`],
            message: 'Invalid split configuration',
          };
        }
        assignedLegacyIds.add(lid);
      }
    }

    // Check that each group has at least one item
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].trackableUnitIds.length === 0 && groups[i].legacyItemIds.length === 0) {
        return {
          success: false,
          shipmentIds: [],
          errors: [`Group ${i + 1} is empty`],
          message: 'Invalid split configuration',
        };
      }
    }

    try {
      const shipmentIds = await this.prisma.$transaction(async (tx) => {
        const ids: string[] = [];

        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
          const reference = `SH-${order.orderNumber}-${i + 1}`;

          // Build items for this group
          const groupUnits = order.trackableUnits.filter((u) =>
            group.trackableUnitIds.includes(u.id)
          );
          const groupLegacyItems = order.lineItems.filter((li) =>
            group.legacyItemIds.includes(li.id)
          );

          const items: any[] = [];
          items.push({
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
          });

          const shipment = await tx.shipment.create({
            data: {
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

        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'converted',
            deliveryStatus: 'assigned',
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: 'order',
            entityId: orderId,
            orderId,
            action: 'delivery_status_changed',
            description: `Order split into ${groups.length} shipments`,
            changes: {
              before: { deliveryStatus: order.deliveryStatus, status: order.status },
              after: { deliveryStatus: 'assigned', status: 'converted' },
              splitShipmentIds: ids,
              splitGroups: groups.length,
            },
          },
        });

        return ids;
      });

      return {
        success: true,
        shipmentIds,
        errors: [],
        message: `Successfully split order into ${shipmentIds.length} shipments`,
      };
    } catch (err: any) {
      return {
        success: false,
        shipmentIds: [],
        errors: [err.message],
        message: 'Failed to split order',
      };
    }
  }

  private buildItemsPayload(orders: any[]): any[] {
    return orders.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackableUnits: (order.trackableUnits || []).map((unit: any) => ({
        unitId: unit.id,
        identifier: unit.identifier,
        unitType: unit.unitType,
        items: (unit.lineItems || []).map((item: any) => ({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit,
        })),
      })),
      legacyItems: (order.lineItems || [])
        .filter((item: any) => !item.trackableUnitId)
        .map((item: any) => ({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          weight: item.weight,
          weightUnit: item.weightUnit,
        })),
    }));
  }
}
