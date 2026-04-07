/**
 * CreateOrderCommand — creates a new order and emits ORDER_CREATED.
 *
 * Extracts logic from POST /api/v1/orders route. The route becomes a thin
 * adapter that validates input, builds the command, and dispatches it.
 */

import { PrismaClient } from '@prisma/client';
import { IEventBus } from '../../events/IEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import {
  CreateOrderDTO,
  CreateOrderLineItemDTO,
  CreateTrackableUnitDTO,
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

export class CreateOrderCommandHandler extends BaseCommandHandler<CreateOrderPayload, CreateOrderResult> {
  readonly commandType = CREATE_ORDER;

  constructor(prisma: PrismaClient, eventBus: IEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateOrderResult> {
    const { orderData, status } = command.payload;

    // Build trackable units create input
    const trackableUnitsCreate = orderData.trackableUnits?.map(
      (unit: CreateTrackableUnitDTO, index: number) => ({
        identifier: unit.identifier,
        unitType: unit.unitType,
        customTypeName: unit.customTypeName,
        barcode: unit.barcode,
        notes: unit.notes,
        sequenceNumber: index + 1,
        lineItems: {
          create: unit.lineItems.map((item: CreateOrderLineItemDTO) => ({
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
          })),
        },
      })
    );

    // Build legacy line items create input
    const lineItemsCreate = orderData.lineItems?.map(
      (item: CreateOrderLineItemDTO) => ({
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
      })
    );

    const order = await tx.order.create({
      data: {
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
