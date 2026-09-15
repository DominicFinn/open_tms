import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordInventoryObservationPayload {
  locationId: string;
  binId: string;
  sku: string;
  uomCode?: string;
  observedQuantity?: number | null; // omitted/null = a pure "I saw this SKU here" scan
  lotNumber?: string;
  notes?: string;
}

export interface RecordInventoryObservationResult {
  observationId: string;
  inventoryRecordId: string | null;
}

export const RECORD_INVENTORY_OBSERVATION = 'inventory_observation.record';

export class RecordInventoryObservationCommandHandler extends BaseCommandHandler<
  RecordInventoryObservationPayload,
  RecordInventoryObservationResult
> {
  readonly commandType = RECORD_INVENTORY_OBSERVATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordInventoryObservationPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<RecordInventoryObservationResult> {
    const p = command.payload;
    const uomCode = p.uomCode ?? 'EA';

    // Bin must belong to the caller's org and the stated location — cross-tenant/cross-location
    // ids read as "not found", same as everywhere else (see the security rule).
    const bin = await tx.warehouseBin.findFirst({
      where: { id: p.binId, orgId: command.orgId, locationId: p.locationId },
    });
    if (!bin) throw new Error(`Bin ${p.binId} not found at location ${p.locationId}`);

    // Best-effort link to the matching stock record, if one exists — an observation is valid
    // even when no InventoryRecord exists yet at this bin/sku (e.g. an unexpected find).
    const inventoryRecord = await tx.inventoryRecord.findFirst({
      where: {
        binId: p.binId,
        sku: p.sku,
        uomCode,
        lotNumber: p.lotNumber ?? null,
        orgId: command.orgId,
      },
    });

    const observation = await tx.inventoryObservation.create({
      data: {
        locationId: p.locationId,
        binId: p.binId,
        sku: p.sku,
        uomCode,
        observedQuantity: p.observedQuantity ?? null,
        lotNumber: p.lotNumber ?? null,
        notes: p.notes ?? null,
        observedByUserId: command.actorId,
        inventoryRecordId: inventoryRecord?.id ?? null,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVENTORY_OBSERVATION_RECORDED,
      entityType: 'inventory_observation',
      entityId: observation.id,
      payload: {
        locationId: p.locationId,
        binId: p.binId,
        sku: p.sku,
        uomCode,
        observedQuantity: p.observedQuantity ?? null,
        inventoryRecordId: inventoryRecord?.id ?? null,
      },
    }));

    return {
      observationId: observation.id,
      inventoryRecordId: inventoryRecord?.id ?? null,
    };
  }
}
