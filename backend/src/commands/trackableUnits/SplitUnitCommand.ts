/**
 * SplitUnitCommand — creates a new TrackableUnit with the same type +
 * packaging type as the source, then moves the specified line items to it.
 * The source unit stays; only its allocation changes.
 *
 * Used when the operator realises one big handling unit should actually be
 * two (e.g. one pallet got over-packed and needs to be split for transport).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SplitUnitPayload {
  /** The unit being split apart. */
  unitId: string;
  /** Line items to peel off onto the new unit. Must currently live on `unitId`. */
  lineItemIds: string[];
  /** Identifier for the new unit. */
  newIdentifier: string;
}

export interface SplitUnitResult {
  newUnitId: string;
  newSequenceNumber: number;
  movedLineItems: number;
}

export const SPLIT_TRACKABLE_UNIT = 'trackable_unit.split';

export class SplitTrackableUnitCommandHandler extends BaseCommandHandler<SplitUnitPayload, SplitUnitResult> {
  readonly commandType = SPLIT_TRACKABLE_UNIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SplitUnitPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<SplitUnitResult> {
    const { unitId, lineItemIds, newIdentifier } = command.payload;

    if (lineItemIds.length === 0) {
      throw new Error('Split requires at least one line item to move to the new unit');
    }

    const source = await tx.trackableUnit.findUniqueOrThrow({ where: { id: unitId } });

    // Ensure the lines actually live on the source unit before we move them.
    const linesOnSource = await tx.orderLineItem.findMany({
      where: { id: { in: lineItemIds }, trackableUnitId: unitId },
      select: { id: true },
    });
    if (linesOnSource.length !== lineItemIds.length) {
      throw new Error('All lineItemIds must currently belong to the source unit');
    }

    const last = await tx.trackableUnit.findFirst({
      where: { orderId: source.orderId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    const newSequenceNumber = (last?.sequenceNumber ?? 0) + 1;

    const newUnit = await tx.trackableUnit.create({
      data: {
        orderId: source.orderId,
        identifier: newIdentifier,
        unitType: source.unitType,
        customTypeName: source.customTypeName,
        packagingTypeId: source.packagingTypeId,
        sequenceNumber: newSequenceNumber,
        weightUnit: source.weightUnit,
        dimUnit: source.dimUnit,
        stackable: source.stackable,
        notes: source.notes,
      },
    });

    await tx.orderLineItem.updateMany({
      where: { id: { in: lineItemIds } },
      data: { trackableUnitId: newUnit.id },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TRACKABLE_UNIT_SPLIT,
      entityType: 'trackable_unit',
      entityId: newUnit.id,
      payload: {
        orderId: source.orderId,
        sourceUnitId: unitId,
        sourceIdentifier: source.identifier,
        newUnitId: newUnit.id,
        newIdentifier,
        newSequenceNumber,
        movedLineItems: lineItemIds.length,
      },
    }));

    return { newUnitId: newUnit.id, newSequenceNumber, movedLineItems: lineItemIds.length };
  }
}
