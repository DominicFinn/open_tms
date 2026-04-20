import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Records physical receipt of a returned item at the dock.
 * Moves the item to the quarantine zone for inspection.
 */
export interface ReceiveRmaLinePayload {
  rmaLineId: string;
  receivedQuantity: number;
  quarantineBinId?: string;               // where the item is parked for inspection
  trackableUnitId?: string;               // if physically tracked
}

export const RECEIVE_RMA_LINE = 'rma_line.receive';

export class ReceiveRmaLineCommandHandler extends BaseCommandHandler<
  ReceiveRmaLinePayload,
  { lineId: string; receivedQuantity: number; rmaFullyReceived: boolean }
> {
  readonly commandType = RECEIVE_RMA_LINE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ReceiveRmaLinePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ lineId: string; receivedQuantity: number; rmaFullyReceived: boolean }> {
    const p = command.payload;

    const line = await tx.rmaLine.findUnique({
      where: { id: p.rmaLineId },
      include: { rma: true },
    });
    if (!line) throw new Error(`RMA line ${p.rmaLineId} not found`);
    if (p.receivedQuantity < 0) throw new Error('Received quantity cannot be negative');
    if (p.receivedQuantity > line.requestedQuantity) {
      throw new Error(`Received quantity ${p.receivedQuantity} exceeds requested ${line.requestedQuantity}`);
    }

    const rma = line.rma;
    if (rma.status !== 'authorized' && rma.status !== 'in_transit' && rma.status !== 'received') {
      throw new Error(`Cannot receive RMA line when RMA is in status ${rma.status}`);
    }

    // Update the line
    await tx.rmaLine.update({
      where: { id: line.id },
      data: {
        receivedQuantity: p.receivedQuantity,
        currentBinId: p.quarantineBinId ?? line.currentBinId,
        trackableUnitId: p.trackableUnitId ?? line.trackableUnitId,
      },
    });

    // Move the trackable unit if provided
    if (p.trackableUnitId && p.quarantineBinId) {
      const bin = await tx.warehouseBin.findUnique({
        where: { id: p.quarantineBinId },
        select: { zoneId: true },
      });
      await tx.trackableUnit.update({
        where: { id: p.trackableUnitId },
        data: {
          currentBinId: p.quarantineBinId,
          currentZoneId: bin?.zoneId ?? null,
          qualityStatus: 'quarantine',
        },
      });
    }

    // If RMA was authorized, bump to received
    if (rma.status === 'authorized') {
      await tx.rma.update({
        where: { id: rma.id },
        data: { status: 'received', receivedAt: new Date() },
      });
    }

    // Check if all lines have been received
    const lines = await tx.rmaLine.findMany({ where: { rmaId: rma.id } });
    const allReceived = lines.every(l => l.receivedQuantity >= l.requestedQuantity || l.id === line.id && p.receivedQuantity >= l.requestedQuantity);

    if (allReceived) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.RMA_GOODS_RECEIVED,
        entityType: 'rma',
        entityId: rma.id,
        payload: { rmaNumber: rma.rmaNumber, lineCount: lines.length },
      }));
    }

    return {
      lineId: line.id,
      receivedQuantity: p.receivedQuantity,
      rmaFullyReceived: allReceived,
    };
  }
}
