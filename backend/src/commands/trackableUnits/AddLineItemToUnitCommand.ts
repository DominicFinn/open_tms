/**
 * AddLineItemToUnitCommand — adds a new OrderLineItem to a specific handling
 * unit. Phase 2: customers/operators can build mixed-SKU pallets by attaching
 * lines to the units they belong on.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { CreateOrderLineItemDTO } from '../../repositories/OrdersRepository.js';

export interface AddLineItemToUnitPayload {
  unitId: string;
  item: CreateOrderLineItemDTO;
}

export interface AddLineItemToUnitResult {
  id: string;
  unitId: string;
}

export const ADD_LINE_ITEM_TO_UNIT = 'trackable_unit.add_line_item';

export class AddLineItemToUnitCommandHandler extends BaseCommandHandler<AddLineItemToUnitPayload, AddLineItemToUnitResult> {
  readonly commandType = ADD_LINE_ITEM_TO_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AddLineItemToUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<AddLineItemToUnitResult> {
    const { unitId, item } = command.payload;

    const unit = await tx.trackableUnit.findUniqueOrThrow({
      where: { id: unitId },
      select: { id: true, orderId: true, identifier: true },
    });

    const created = await tx.orderLineItem.create({
      data: {
        orderId: unit.orderId,
        trackableUnitId: unitId,
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
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_ADDED,
      entityType: 'trackable_unit',
      entityId: unitId,
      payload: {
        orderId: unit.orderId,
        unitIdentifier: unit.identifier,
        lineItemId: created.id,
        sku: created.sku,
        quantity: created.quantity,
      },
    }));

    return { id: created.id, unitId };
  }
}
