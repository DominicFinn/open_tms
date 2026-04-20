import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RecordPackAuditPayload {
  packTaskId: string;
  cartonCatalogueId?: string;

  actualWeightGrams: number;
  actualLengthMm?: number;
  actualWidthMm?: number;
  actualHeightMm?: number;

  /** Optional override if the caller has a pre-computed expected weight (rare). */
  expectedWeightGramsOverride?: number;

  /** Tolerance percent (e.g. 10 = 10%). Defaults to 10 when omitted. */
  weightTolerancePercent?: number;

  notes?: string;
}

export interface RecordPackAuditResult {
  id: string;
  verdict: 'pass' | 'warning' | 'fail';
  weightVariancePercent: number;
  dimWeightVariancePercent: number | null;
  expectedWeightGrams: number;
  issueId: string | null;
}

export const RECORD_PACK_AUDIT = 'pack_audit.record';

const DIM_WEIGHT_DIVISOR_CM = 5000; // industry standard: (L*W*H in cm) / 5000 → kg

function verdictFor(weightVariance: number, tolerance: number): 'pass' | 'warning' | 'fail' {
  const abs = Math.abs(weightVariance);
  if (abs <= tolerance) return 'pass';
  if (abs <= tolerance * 2) return 'warning';
  return 'fail';
}

export class RecordPackAuditCommandHandler extends BaseCommandHandler<
  RecordPackAuditPayload,
  RecordPackAuditResult
> {
  readonly commandType = RECORD_PACK_AUDIT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RecordPackAuditPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<RecordPackAuditResult> {
    const p = command.payload;

    if (!p.actualWeightGrams || p.actualWeightGrams < 1) {
      throw new Error('actualWeightGrams is required and must be positive');
    }

    const tolerance = p.weightTolerancePercent ?? 10;
    if (tolerance < 0 || tolerance > 100) throw new Error('weightTolerancePercent must be between 0 and 100');

    const packTask = await tx.packTask.findUnique({
      where: { id: p.packTaskId },
      include: {
        packLines: true,
      },
    });
    if (!packTask) throw new Error(`PackTask ${p.packTaskId} not found`);

    // Compute expected weight. If override supplied, trust it. Otherwise look up
    // each pack line's SKU weight × expected quantity via the default ProductUom.
    let expectedWeightGrams: number;
    if (p.expectedWeightGramsOverride != null) {
      expectedWeightGrams = p.expectedWeightGramsOverride;
    } else {
      let total = 0;
      const skus = Array.from(new Set(packTask.packLines.map(l => l.sku)));
      const uoms = await tx.productUom.findMany({
        where: { orgId: command.orgId, sku: { in: skus }, isDefault: true },
        select: { sku: true, weightGrams: true },
      });
      const weightBySku = new Map(uoms.map(u => [u.sku, u.weightGrams ?? 0]));
      for (const line of packTask.packLines) {
        total += (weightBySku.get(line.sku) ?? 0) * line.expectedQuantity;
      }
      expectedWeightGrams = total;
    }

    // Add carton tare if specified
    let expectedLengthMm: number | null = null;
    let expectedWidthMm: number | null = null;
    let expectedHeightMm: number | null = null;
    if (p.cartonCatalogueId) {
      const carton = await tx.cartonCatalogue.findUnique({ where: { id: p.cartonCatalogueId } });
      if (carton) {
        expectedLengthMm = carton.lengthMm;
        expectedWidthMm = carton.widthMm;
        expectedHeightMm = carton.heightMm;
        // Carton tare is not modelled; if it were we'd add it here.
      }
    }

    if (expectedWeightGrams <= 0) {
      throw new Error('Cannot compute expected weight: no SKU weights configured for the pack lines');
    }

    const weightVariancePercent = ((p.actualWeightGrams - expectedWeightGrams) / expectedWeightGrams) * 100;

    // Dim weight comparison (when all actual dims provided)
    let dimWeightVariancePercent: number | null = null;
    if (p.actualLengthMm && p.actualWidthMm && p.actualHeightMm && expectedLengthMm && expectedWidthMm && expectedHeightMm) {
      const expectedCubicCm = (expectedLengthMm / 10) * (expectedWidthMm / 10) * (expectedHeightMm / 10);
      const actualCubicCm = (p.actualLengthMm / 10) * (p.actualWidthMm / 10) * (p.actualHeightMm / 10);
      const expectedDimKg = expectedCubicCm / DIM_WEIGHT_DIVISOR_CM;
      const actualDimKg = actualCubicCm / DIM_WEIGHT_DIVISOR_CM;
      if (expectedDimKg > 0) {
        dimWeightVariancePercent = ((actualDimKg - expectedDimKg) / expectedDimKg) * 100;
      }
    }

    const verdict = verdictFor(weightVariancePercent, tolerance);

    let issueId: string | null = null;
    if (verdict !== 'pass') {
      const title = verdict === 'fail'
        ? `Pack audit failure on PackTask ${packTask.id.slice(0, 8)}: ${weightVariancePercent.toFixed(1)}% weight variance`
        : `Pack audit warning on PackTask ${packTask.id.slice(0, 8)}: ${weightVariancePercent.toFixed(1)}% weight variance`;
      const issue = await tx.issue.create({
        data: {
          orgId: command.orgId,
          title,
          description: `Expected ${expectedWeightGrams}g, actual ${p.actualWeightGrams}g (tolerance ±${tolerance}%).` +
            (dimWeightVariancePercent != null ? ` Dim weight variance ${dimWeightVariancePercent.toFixed(1)}%.` : '') +
            (p.notes ? `\n\nAuditor notes: ${p.notes}` : ''),
          priority: verdict === 'fail' ? 'high' : 'medium',
          category: 'quality',
          sourceEntityType: 'pack_task',
          sourceEntityId: packTask.id,
          status: 'open',
        },
      });
      issueId = issue.id;
    }

    const audit = await tx.packAudit.create({
      data: {
        packTaskId: packTask.id,
        cartonCatalogueId: p.cartonCatalogueId ?? null,
        expectedWeightGrams,
        expectedLengthMm,
        expectedWidthMm,
        expectedHeightMm,
        actualWeightGrams: p.actualWeightGrams,
        actualLengthMm: p.actualLengthMm ?? null,
        actualWidthMm: p.actualWidthMm ?? null,
        actualHeightMm: p.actualHeightMm ?? null,
        weightVariancePercent: new Prisma.Decimal(weightVariancePercent.toFixed(2)),
        dimWeightVariancePercent: dimWeightVariancePercent != null ? new Prisma.Decimal(dimWeightVariancePercent.toFixed(2)) : null,
        weightTolerancePercent: new Prisma.Decimal(tolerance.toFixed(2)),
        verdict,
        notes: p.notes ?? null,
        issueId,
        auditorId: command.actorId,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PACK_AUDIT_RECORDED,
      entityType: 'pack_audit',
      entityId: audit.id,
      payload: {
        packTaskId: packTask.id,
        orderId: packTask.orderId,
        verdict,
        expectedWeightGrams,
        actualWeightGrams: p.actualWeightGrams,
        weightVariancePercent: Number(weightVariancePercent.toFixed(2)),
        dimWeightVariancePercent: dimWeightVariancePercent != null ? Number(dimWeightVariancePercent.toFixed(2)) : null,
        tolerance,
        issueId,
      },
    }));

    if (verdict !== 'pass') {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED,
        entityType: 'pack_audit',
        entityId: audit.id,
        payload: {
          packTaskId: packTask.id,
          orderId: packTask.orderId,
          verdict,
          weightVariancePercent: Number(weightVariancePercent.toFixed(2)),
          issueId,
        },
      }));
    }

    return {
      id: audit.id,
      verdict,
      weightVariancePercent: Number(weightVariancePercent.toFixed(2)),
      dimWeightVariancePercent: dimWeightVariancePercent != null ? Number(dimWeightVariancePercent.toFixed(2)) : null,
      expectedWeightGrams,
      issueId,
    };
  }
}
