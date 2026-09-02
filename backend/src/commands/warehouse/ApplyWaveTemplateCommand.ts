import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Applies a wave template: finds eligible orders matching the template's
 * grouping rules, creates a wave, and optionally auto-releases it.
 */
export interface ApplyWaveTemplatePayload {
  templateId: string;
  /** Override auto-release setting for this run */
  autoRelease?: boolean;
}

export const APPLY_WAVE_TEMPLATE = 'wave_template.apply';

export class ApplyWaveTemplateCommandHandler extends BaseCommandHandler<
  ApplyWaveTemplatePayload,
  { waveId: string | null; waveNumber: string | null; orderCount: number; skipped: boolean; skipReason: string | null }
> {
  readonly commandType = APPLY_WAVE_TEMPLATE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ApplyWaveTemplatePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ waveId: string | null; waveNumber: string | null; orderCount: number; skipped: boolean; skipReason: string | null }> {
    const template = await tx.waveTemplate.findUnique({ where: { id: command.payload.templateId } });
    if (!template) throw new Error(`Wave template ${command.payload.templateId} not found`);
    if (!template.active) throw new Error('Template is inactive');

    // Eligibility runs against the warehouse's own view of demand, not the TMS order tables.
    // Both halves are org-scoped: an unscoped query here pulled another tenant's orders into
    // a wave.
    const alreadyWaved = await tx.waveOrder.findMany({
      where: {
        wave: { orgId: command.orgId, status: { notIn: ['completed', 'cancelled'] } },
      },
      select: { orderId: true },
    });

    const demandWhere: Prisma.WmsFulfilmentOrderWhereInput = {
      orgId: command.orgId,
      sourceId: { notIn: alreadyWaved.map((wo) => wo.orderId) },
    };

    // Apply grouping rules if present
    const rules = template.groupingRules as Record<string, unknown> | null;
    if (rules) {
      if (rules.customer) demandWhere.customerId = rules.customer as string;
      if (rules.status) demandWhere.status = rules.status as string;
      // shipFrom maps to origin location
      if (rules.shipFrom) demandWhere.originLocationId = rules.shipFrom as string;
    }

    // Find eligible orders
    let orders = (await tx.wmsFulfilmentOrder.findMany({
      where: demandWhere,
      select: { sourceId: true, lineCount: true },
      orderBy: { sourceCreatedAt: 'asc' },
    })).map((demand) => ({ id: demand.sourceId, lineCount: demand.lineCount }));

    // Apply min/max constraints
    if (template.minOrders && orders.length < template.minOrders) {
      return {
        waveId: null, waveNumber: null, orderCount: orders.length,
        skipped: true, skipReason: `Only ${orders.length} orders available, minimum is ${template.minOrders}`,
      };
    }

    if (template.maxOrders && orders.length > template.maxOrders) {
      orders = orders.slice(0, template.maxOrders);
    }

    if (orders.length === 0) {
      return {
        waveId: null, waveNumber: null, orderCount: 0,
        skipped: true, skipReason: 'No eligible orders found',
      };
    }

    // Generate wave number
    const today = new Date().toISOString().slice(0, 10);
    const existing = await tx.wave.count({
      where: { orgId: command.orgId, waveNumber: { startsWith: `W-${today}` } },
    });
    const waveNumber = `W-${today}-${String(existing + 1).padStart(3, '0')}`;

    // Count total line items
    const lineCount = orders.reduce((sum, order) => sum + order.lineCount, 0);

    // Resolve cutoff time to a datetime
    let cutoffAt: Date | null = null;
    if (template.cutoffTime) {
      const [hours, minutes] = template.cutoffTime.split(':').map(Number);
      cutoffAt = new Date();
      cutoffAt.setHours(hours, minutes, 0, 0);
    }

    // Create the wave
    const wave = await tx.wave.create({
      data: {
        locationId: template.locationId,
        templateId: template.id,
        waveNumber,
        status: 'planning',
        pickStrategy: template.pickStrategy,
        groupingCriteria: template.groupingRules as Prisma.InputJsonValue ?? undefined,
        orderCount: orders.length,
        lineCount,
        cutoffAt,
        orgId: command.orgId,
      },
    });

    // Link orders
    await tx.waveOrder.createMany({
      data: orders.map((o, i) => ({ waveId: wave.id, orderId: o.id, priority: i })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_CREATED,
      entityType: 'wave',
      entityId: wave.id,
      payload: {
        waveNumber,
        locationId: template.locationId,
        pickStrategy: template.pickStrategy,
        orderCount: orders.length,
        lineCount,
        templateId: template.id,
        templateName: template.name,
      },
    }));

    return {
      waveId: wave.id,
      waveNumber,
      orderCount: orders.length,
      skipped: false,
      skipReason: null,
    };
  }
}
