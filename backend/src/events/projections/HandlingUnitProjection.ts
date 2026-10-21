/**
 * HandlingUnitProjection: keeps the warehouse's copy of each TMS unit's identity and contents, so
 * warehouse code never reads TrackableUnit (#357).
 *
 * A handling unit has the same id as its TrackableUnit. The projection writes only the snapshot
 * fields (identifier, type, barcode, order, contents). Bin, zone, lot, quality, owner and nesting
 * are warehouse state that WMS commands write, and the projection never touches them, so a late or
 * replayed unit event can't move a pallet.
 *
 * Like WmsFulfilmentOrderProjection it re-reads the whole unit on every event rather than patching
 * from payloads: unit and line events interleave, and re-projecting is idempotent.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import type { HandlingUnitSnapshot, IHandlingUnitSource } from '../../ports/handlingUnitSource.js';

const SOURCE_TYPE = 'tms_trackable_unit';

type UnitPayload = {
  orderId?: string;
  fromUnitId?: string | null;
  toUnitId?: string | null;
  sourceUnitId?: string;
  targetUnitId?: string;
  newUnitId?: string;
};

export class HandlingUnitProjection implements IEventHandler {
  readonly name = 'projection.handling_unit';
  readonly eventPatterns = ['trackable_unit.*', 'order_line_item.*', 'order.deleted'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
  };

  constructor(
    private prisma: PrismaClient,
    private source: IHandlingUnitSource
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    for (const unitId of await this.affectedUnits(event)) {
      await this.project(event.orgId, unitId);
    }
    if (event.type === EVENT_TYPES.ORDER_DELETED) {
      await this.markOrderRemoved(event.orgId, event.entityId);
    }
  }

  /** The units an event may have changed. Most name one; moves, merges and splits name two. */
  private async affectedUnits(event: DomainEvent): Promise<string[]> {
    const payload = (event.payload ?? {}) as UnitPayload;
    switch (event.type) {
      case EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED:
        return [payload.fromUnitId, payload.toUnitId].filter((id): id is string => !!id);
      case EVENT_TYPES.TRACKABLE_UNITS_MERGED:
        return [payload.sourceUnitId, payload.targetUnitId].filter((id): id is string => !!id);
      case EVENT_TYPES.TRACKABLE_UNIT_SPLIT:
        return [payload.sourceUnitId, payload.newUnitId].filter((id): id is string => !!id);
      case EVENT_TYPES.ORDER_LINE_ITEM_CREATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_UPDATED:
      case EVENT_TYPES.ORDER_LINE_ITEM_DELETED:
        // Line events carry the line's id, and a line may have moved units, so re-project the
        // whole order's units.
        return payload.orderId ? this.source.listSourceIdsForOrder(event.orgId, payload.orderId) : [];
      case EVENT_TYPES.ORDER_DELETED:
        return [];
      default:
        return event.type.startsWith('trackable_unit.') ? [event.entityId] : [];
    }
  }

  /** Re-reads the unit and writes its snapshot, or marks it removed upstream. */
  async project(orgId: string, sourceId: string): Promise<void> {
    const snapshot = await this.source.getSnapshot(orgId, sourceId);
    if (!snapshot) {
      await this.markRemoved(orgId, sourceId);
      return;
    }
    await this.write(snapshot);
  }

  private async write(snapshot: HandlingUnitSnapshot): Promise<void> {
    const fields = {
      sourceOrderId: snapshot.sourceOrderId,
      sourceRemovedAt: null,
      identifier: snapshot.identifier,
      unitType: snapshot.unitType,
      customTypeName: snapshot.customTypeName,
      barcode: snapshot.barcode,
    };

    await this.prisma.handlingUnit.upsert({
      where: {
        orgId_sourceType_sourceId: { orgId: snapshot.orgId, sourceType: snapshot.sourceType, sourceId: snapshot.sourceId },
      },
      create: {
        id: snapshot.sourceId,
        orgId: snapshot.orgId,
        sourceType: snapshot.sourceType,
        sourceId: snapshot.sourceId,
        ...fields,
      },
      update: fields,
    });

    // Contents are a projection of the source, so they are replaced wholesale.
    await this.prisma.$transaction([
      this.prisma.handlingUnitLine.deleteMany({ where: { handlingUnitId: snapshot.sourceId, orgId: snapshot.orgId } }),
      this.prisma.handlingUnitLine.createMany({
        data: snapshot.lines.map((line) => ({
          handlingUnitId: snapshot.sourceId,
          orgId: snapshot.orgId,
          sourceLineId: line.sourceLineId,
          sku: line.sku,
          description: line.description,
          quantity: line.quantity,
          weight: line.weight,
          hazmat: line.hazmat,
          temperature: line.temperature,
        })),
      }),
    ]);
  }

  /**
   * For the backfill: units deleted upstream while no event reached the projection. Re-projecting
   * them finds no source and marks them removed.
   */
  async markMissingRemoved(liveSourceIds: ReadonlySet<string>): Promise<void> {
    // tenancy-exempt: a backfill sweep reads every org, and each row is re-projected under its own org
    const known = await this.prisma.handlingUnit.findMany({
      where: { sourceType: SOURCE_TYPE, sourceRemovedAt: null },
      select: { orgId: true, sourceId: true },
    });
    for (const unit of known) {
      if (!liveSourceIds.has(unit.sourceId)) await this.project(unit.orgId, unit.sourceId);
    }
  }

  // BUSINESS RULE: a unit removed upstream is marked, not deleted. The warehouse may still be
  // holding the pallet, and deleting it would lose where it is.
  private async markRemoved(orgId: string, sourceId: string): Promise<void> {
    await this.prisma.handlingUnit.updateMany({
      where: { orgId, sourceType: SOURCE_TYPE, sourceId, sourceRemovedAt: null },
      data: { sourceRemovedAt: new Date() },
    });
  }

  private async markOrderRemoved(orgId: string, orderId: string): Promise<void> {
    await this.prisma.handlingUnit.updateMany({
      where: { orgId, sourceType: SOURCE_TYPE, sourceOrderId: orderId, sourceRemovedAt: null },
      data: { sourceRemovedAt: new Date() },
    });
  }
}
