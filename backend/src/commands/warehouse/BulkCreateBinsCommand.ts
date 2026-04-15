import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface BulkCreateBinsPayload {
  zoneId: string;
  locationId: string;
  /** Pattern with placeholders: {aisle}, {row}, {level} e.g. "BULK-{aisle}-{row}-{level}" */
  labelPattern: string;
  binType: string;
  aisles: string[];       // e.g. ["A", "B", "C"]
  rowStart: number;       // e.g. 1
  rowEnd: number;         // e.g. 10
  levelStart: number;     // e.g. 1
  levelEnd: number;       // e.g. 4
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  maxPalletPositions?: number | null;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
}

export const BULK_CREATE_BINS = 'warehouse_bin.bulk_create';

export class BulkCreateBinsCommandHandler extends BaseCommandHandler<
  BulkCreateBinsPayload,
  { count: number; labels: string[] }
> {
  readonly commandType = BULK_CREATE_BINS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<BulkCreateBinsPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ count: number; labels: string[] }> {
    const p = command.payload;

    // Verify zone exists
    const zone = await tx.warehouseZone.findUnique({ where: { id: p.zoneId } });
    if (!zone) throw new Error(`Zone ${p.zoneId} not found`);

    // Generate all bin records
    const bins: Array<{
      zoneId: string;
      locationId: string;
      label: string;
      binType: string;
      maxWeightKg: number | null;
      maxVolumeCbm: number | null;
      maxPalletPositions: number | null;
      temperatureZone: string | null;
      hazmatCertified: boolean;
      level: number;
      walkSequence: number;
      orgId: string;
    }> = [];

    let walkSeq = 0;
    const labels: string[] = [];

    for (const aisle of p.aisles) {
      for (let row = p.rowStart; row <= p.rowEnd; row++) {
        for (let level = p.levelStart; level <= p.levelEnd; level++) {
          const label = p.labelPattern
            .replace('{aisle}', aisle)
            .replace('{row}', String(row).padStart(2, '0'))
            .replace('{level}', String(level).padStart(2, '0'));

          bins.push({
            zoneId: p.zoneId,
            locationId: p.locationId,
            label,
            binType: p.binType,
            maxWeightKg: p.maxWeightKg ?? null,
            maxVolumeCbm: p.maxVolumeCbm ?? null,
            maxPalletPositions: p.maxPalletPositions ?? null,
            temperatureZone: p.temperatureZone ?? null,
            hazmatCertified: p.hazmatCertified ?? false,
            level,
            walkSequence: walkSeq++,
            orgId: command.orgId,
          });
          labels.push(label);
        }
      }
    }

    if (bins.length === 0) throw new Error('No bins to create - check your range parameters');
    if (bins.length > 10000) throw new Error(`Too many bins (${bins.length}). Maximum 10,000 per bulk operation.`);

    // Check for label conflicts
    const existingLabels = await tx.warehouseBin.findMany({
      where: { locationId: p.locationId, label: { in: labels } },
      select: { label: true },
    });
    if (existingLabels.length > 0) {
      throw new Error(`Labels already exist: ${existingLabels.map(b => b.label).slice(0, 5).join(', ')}${existingLabels.length > 5 ? ` and ${existingLabels.length - 5} more` : ''}`);
    }

    const result = await tx.warehouseBin.createMany({ data: bins });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAREHOUSE_BIN_BULK_CREATED,
      entityType: 'warehouse_zone',
      entityId: p.zoneId,
      payload: {
        zoneId: p.zoneId,
        locationId: p.locationId,
        count: result.count,
        labelPattern: p.labelPattern,
        binType: p.binType,
      },
    }));

    return { count: result.count, labels };
  }
}
