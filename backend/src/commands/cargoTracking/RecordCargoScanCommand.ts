import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordCargoScanPayload {
  shipmentId: string;
  shipmentStopId: string;
  trackableUnitId: string;
  scanType: string;
  scannedBy?: string;
  notes?: string;
  deviceId?: string;
  lat?: number;
  lng?: number;
}

export const RECORD_CARGO_SCAN = 'cargo.record_scan';

export class RecordCargoScanCommandHandler extends BaseCommandHandler<RecordCargoScanPayload, { id: string }> {
  readonly commandType = RECORD_CARGO_SCAN;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<RecordCargoScanPayload>, tx: TransactionClient, emit: EmitFn) {
    const scan = await tx.cargoScan.create({ data: command.payload as any });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARGO_SCAN_RECORDED,
      entityType: 'cargo_scan',
      entityId: scan.id,
      payload: {
        shipmentId: command.payload.shipmentId,
        trackableUnitId: command.payload.trackableUnitId,
        scanType: command.payload.scanType,
        stopId: command.payload.shipmentStopId,
      },
    }));

    return { id: scan.id };
  }
}
