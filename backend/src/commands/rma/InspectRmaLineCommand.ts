import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Inspector sets the final disposition on an RMA line after physical inspection.
 * This is the decision point that routes the item to its next physical destination.
 */
export interface InspectRmaLinePayload {
  rmaLineId: string;
  inspectionStatus: string;              // pass, fail, partial_damage
  disposition: string;                   // restock, refurb, scrap, recycle, donate, rtv, customer_keeps
  inspectionNotes?: string;
  conditionPhotos?: string[];            // storage keys
  /** Where the item should be routed next (putaway target bin for restock, refurb zone, etc.) */
  routeToBinId?: string;
}

export const INSPECT_RMA_LINE = 'rma_line.inspect';

const VALID_DISPOSITIONS = ['restock', 'refurb', 'scrap', 'recycle', 'donate', 'rtv', 'customer_keeps'];

export class InspectRmaLineCommandHandler extends BaseCommandHandler<
  InspectRmaLinePayload,
  { lineId: string; disposition: string; allLinesDispositioned: boolean }
> {
  readonly commandType = INSPECT_RMA_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<InspectRmaLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ lineId: string; disposition: string; allLinesDispositioned: boolean }> {
    const p = command.payload;

    if (!VALID_DISPOSITIONS.includes(p.disposition)) {
      throw new Error(`Invalid disposition: ${p.disposition}. Must be one of: ${VALID_DISPOSITIONS.join(', ')}`);
    }

    const line = await tx.rmaLine.findUnique({
      where: { id: p.rmaLineId },
      include: { rma: true },
    });
    if (!line) throw new Error(`RMA line ${p.rmaLineId} not found`);
    if (line.disposition !== 'pending') {
      throw new Error(`Line already has disposition: ${line.disposition}`);
    }
    if (line.receivedQuantity === 0) {
      throw new Error('Cannot inspect a line that has not been received');
    }

    const rma = line.rma;

    // Update the line with disposition
    await tx.rmaLine.update({
      where: { id: line.id },
      data: {
        inspectionStatus: p.inspectionStatus,
        disposition: p.disposition,
        inspectionNotes: p.inspectionNotes ?? null,
        conditionPhotos: p.conditionPhotos ? (p.conditionPhotos as unknown as Prisma.InputJsonValue) : undefined,
        inspectedByUserId: command.actorId,
        inspectedAt: new Date(),
        currentBinId: p.routeToBinId ?? line.currentBinId,
      },
    });

    // Move trackable unit if routing
    if (line.trackableUnitId && p.routeToBinId) {
      const bin = await tx.warehouseBin.findUnique({
        where: { id: p.routeToBinId },
        select: { zoneId: true },
      });

      // For restock, mark unit as available again. For other dispositions, keep quarantine or relevant status.
      const qualityStatus = p.disposition === 'restock' ? 'available'
        : p.disposition === 'refurb' ? 'hold'
        : p.disposition === 'scrap' ? 'damaged'
        : 'quarantine';

      await tx.trackableUnit.update({
        where: { id: line.trackableUnitId },
        data: {
          currentBinId: p.routeToBinId,
          currentZoneId: bin?.zoneId ?? null,
          qualityStatus,
        },
      });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_LINE_INSPECTED,
      entityType: 'rma_line',
      entityId: line.id,
      payload: {
        rmaId: rma.id,
        rmaNumber: rma.rmaNumber,
        sku: line.sku,
        disposition: p.disposition,
        inspectionStatus: p.inspectionStatus,
      },
    }));

    // Update RMA status if all lines dispositioned
    const lines = await tx.rmaLine.findMany({ where: { rmaId: rma.id } });
    const allDispositioned = lines.every(l => l.disposition !== 'pending' || l.id === line.id);

    if (allDispositioned && rma.status !== 'dispositioning') {
      await tx.rma.update({
        where: { id: rma.id },
        data: { status: 'dispositioning' },
      });

      emit(this.createEvent(command, {
        type: EVENT_TYPES.RMA_DISPOSITION_SET,
        entityType: 'rma',
        entityId: rma.id,
        payload: {
          rmaNumber: rma.rmaNumber,
          dispositions: lines.map(l => ({
            sku: l.sku,
            disposition: l.id === line.id ? p.disposition : l.disposition,
          })),
        },
      }));
    } else if (rma.status === 'received') {
      await tx.rma.update({
        where: { id: rma.id },
        data: { status: 'inspecting' },
      });
    }

    return {
      lineId: line.id,
      disposition: p.disposition,
      allLinesDispositioned: allDispositioned,
    };
  }
}
