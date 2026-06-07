/**
 * CreateOrderCommand — creates a new order and emits ORDER_CREATED.
 *
 * Extracts logic from POST /api/v1/orders route. The route becomes a thin
 * adapter that validates input, builds the command, and dispatches it.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import {
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateTrackableUnitDTO,
  PackingSummaryDTO,
} from '../../repositories/OrdersRepository.js';

export interface CreateOrderPayload {
  orderData: CreateOrderDTO;
  /** Pre-computed status from location validation logic */
  status: string;
}

export interface CreateOrderResult {
  id: string;
  orderNumber: string;
  status: string;
}

export const CREATE_ORDER = 'order.create';

/**
 * Map a line-item DTO to the Prisma nested-create input. Centralised so
 * trackable-unit-nested and legacy-flat creates stay in sync as the line
 * schema grows.
 */
function lineItemCreateInput(item: CreateOrderLineItemDTO) {
  return {
    sku: item.sku,
    description: item.description,
    quantity: item.quantity,
    weight: item.weight,
    weightUnit: item.weightUnit,
    length: item.length,
    width: item.width,
    height: item.height,
    dimUnit: item.dimUnit,
    hazmat: item.hazmat,
    temperature: item.temperature,

    unitOfMeasure: item.unitOfMeasure,
    unitPriceCents: item.unitPriceCents,
    totalPriceCents: item.totalPriceCents,
    priceCurrency: item.priceCurrency,
    freightClass: item.freightClass,
    nmfcCode: item.nmfcCode,

    unNumber: item.unNumber,
    hazmatClass: item.hazmatClass,
    packingGroup: item.packingGroup,
    properShippingName: item.properShippingName,
    hsCode: item.hsCode,
    countryOfOrigin: item.countryOfOrigin,
    tempMinC: item.tempMinC,
    tempMaxC: item.tempMaxC,
  };
}

/**
 * Auto-generate empty TrackableUnits from the order-level packing summary.
 * Phase 1 keeps it simple: N units, all of one packaging type and stackable
 * flag, no per-unit line allocation. Customers can split lines onto specific
 * units later in Phase 2.
 */
function trackableUnitsFromPackingSummary(summary: PackingSummaryDTO, unitTypeFallback: string) {
  const count = Math.max(0, Math.floor(summary.unitCount));
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push({
      identifier: `${unitTypeFallback.toUpperCase()}-${String(i).padStart(3, '0')}`,
      unitType: unitTypeFallback,
      customTypeName: undefined as string | undefined,
      barcode: undefined as string | undefined,
      notes: summary.notes,
      packagingTypeId: summary.packagingTypeId ?? undefined,
      sequenceNumber: i,
      lineItems: { create: [] as any[] },
    });
  }
  return out;
}

export class CreateOrderCommandHandler extends BaseCommandHandler<CreateOrderPayload, CreateOrderResult> {
  readonly commandType = CREATE_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateOrderResult> {
    const { orderData, status } = command.payload;

    // Build trackable units create input (explicit list takes precedence)
    let trackableUnitsCreate = orderData.trackableUnits?.map(
      (unit: CreateTrackableUnitDTO, index: number) => ({
        identifier: unit.identifier,
        unitType: unit.unitType,
        customTypeName: unit.customTypeName,
        barcode: unit.barcode,
        notes: unit.notes,
        packagingTypeId: unit.packagingTypeId ?? undefined,
        sequenceNumber: index + 1,
        lineItems: {
          create: unit.lineItems.map(lineItemCreateInput),
        },
      })
    );

    // Otherwise, derive units from the packing summary (Phase 1 portal flow).
    // packagingTypeId on the summary tells us what kind to label the units.
    if (!trackableUnitsCreate?.length && orderData.packingSummary && orderData.packingSummary.unitCount > 0) {
      const kindLabel = await (async () => {
        const id = orderData.packingSummary!.packagingTypeId;
        if (!id) return 'pallet';
        const pt = await tx.packagingType.findUnique({ where: { id }, select: { kind: true } });
        return pt?.kind ?? 'pallet';
      })();
      trackableUnitsCreate = trackableUnitsFromPackingSummary(orderData.packingSummary, kindLabel);
    }

    // Build legacy line items create input
    const lineItemsCreate = orderData.lineItems?.map(lineItemCreateInput);

    // Multi-tenancy: prefer an explicit orgId on the payload so admin
    // tools that act on behalf of a tenant can set it; fall back to the
    // dispatching command's orgId (the JWT path). Order.orgId is NOT
    // NULL post phase-2 tightening — throw rather than write a half-built
    // row when neither source supplies one.
    const orgIdToWrite = (orderData as any).orgId || command.orgId;
    if (!orgIdToWrite) {
      throw new Error('orgId is required to create an Order (multi-tenancy)');
    }

    const order = await tx.order.create({
      data: {
        orgId: orgIdToWrite,
        orderNumber: orderData.orderNumber,
        poNumber: orderData.poNumber,
        customerId: orderData.customerId,
        importSource: orderData.importSource,
        ediData: orderData.ediData,
        originId: orderData.originId,
        destinationId: orderData.destinationId,
        originData: orderData.originData,
        destinationData: orderData.destinationData,
        originValidated: !!orderData.originId,
        destinationValidated: !!orderData.destinationId,
        orderDate: orderData.orderDate,
        requestedPickupDate: orderData.requestedPickupDate,
        requestedDeliveryDate: orderData.requestedDeliveryDate,
        specialInstructions: orderData.specialInstructions,
        notes: orderData.notes,
        status,
        // Use 'as any' to match existing OrdersRepository pattern for nested creates
        trackableUnits: trackableUnitsCreate?.length
          ? { create: trackableUnitsCreate as any }
          : undefined,
        lineItems: lineItemsCreate?.length
          ? { create: lineItemsCreate as any }
          : undefined,
      },
      include: {
        customer: { select: { id: true, name: true, contactEmail: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
        trackableUnits: { include: { lineItems: true }, orderBy: { sequenceNumber: 'asc' } },
        lineItems: true,
      },
    });

    const tuCount = (order as any).trackableUnits?.length ?? 0;
    const liCount = (order as any).lineItems?.length ?? 0;

    // Emit domain event
    emit(
      this.createEvent(command, {
        type: EVENT_TYPES.ORDER_CREATED,
        entityType: 'order',
        entityId: order.id,
        payload: {
          orderReference: order.orderNumber,
          customerId: order.customerId,
          status: order.status,
          originId: order.originId,
          destinationId: order.destinationId,
          trackableUnitCount: tuCount,
          lineItemCount: liCount,
          importSource: order.importSource,
          packingSummary: orderData.packingSummary
            ? {
                packagingTypeId: orderData.packingSummary.packagingTypeId ?? null,
                unitCount: orderData.packingSummary.unitCount,
                stackable: orderData.packingSummary.stackable ?? null,
              }
            : null,
        },
      })
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
    };
  }
}
