import { PrismaClient, WaveTemplate } from '@prisma/client';
import { ICommandBus } from '../../commands/CommandBus.js';
import { APPLY_WAVE_TEMPLATE } from '../../commands/warehouse/ApplyWaveTemplateCommand.js';
import crypto from 'crypto';

export interface AutoReleaseResult {
  templatesChecked: number;
  templatesTriggered: number;
  triggered: Array<{ templateId: string; name: string; waveNumber?: string; skipped?: boolean; reason?: string }>;
}

/**
 * WaveAutoReleaseService
 *
 * Scans active wave templates with `autoRelease = true` and fires APPLY_WAVE_TEMPLATE
 * when their schedule is due and we haven't already released one from this template
 * for the current slot.
 *
 * Schedule support (v1):
 *  - `releaseSchedule` as HH:MM (24h local time) - once a day at that time
 *  - Falls back to `cutoffTime` if `releaseSchedule` is null (release right after cutoff)
 *
 * Dedup: `lastAutoReleasedAt` tracks the last successful release. A template
 * doesn't re-release within a 12h window of its last auto-release, which covers
 * the "once per day" common case without a full cron parser. Manual `apply`
 * calls through the route still work and update lastAutoReleasedAt is untouched.
 */
export class WaveAutoReleaseService {
  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
  ) {}

  async runOnce(now: Date = new Date()): Promise<AutoReleaseResult> {
    const templates = await this.prisma.waveTemplate.findMany({
      where: { autoRelease: true, active: true },
    });

    const result: AutoReleaseResult = {
      templatesChecked: templates.length,
      templatesTriggered: 0,
      triggered: [],
    };

    for (const t of templates) {
      if (!this.shouldRelease(t, now)) continue;

      const cmdResult = await this.commandBus.dispatch({
        type: APPLY_WAVE_TEMPLATE,
        orgId: t.orgId,
        actorId: 'wave-auto-release',
        payload: { templateId: t.id },
        metadata: { correlationId: crypto.randomUUID(), source: 'wave-auto-release-worker' },
      });

      if (cmdResult.success) {
        await this.prisma.waveTemplate.update({
          where: { id: t.id },
          data: { lastAutoReleasedAt: now },
        });
        result.templatesTriggered++;
        result.triggered.push({
          templateId: t.id, name: t.name,
          waveNumber: (cmdResult.data as any)?.waveNumber,
          skipped: (cmdResult.data as any)?.skipped,
          reason: (cmdResult.data as any)?.skipReason,
        });
      } else {
        result.triggered.push({
          templateId: t.id, name: t.name,
          skipped: true, reason: cmdResult.error,
        });
      }
    }

    return result;
  }

  /**
   * Is this template due for auto-release right now?
   * Returns true when:
   *  1. A schedule (releaseSchedule or cutoffTime) exists
   *  2. We haven't released within the dedup window (12h default)
   *  3. Current time has passed the scheduled HH:MM today
   */
  shouldRelease(t: WaveTemplate, now: Date, dedupWindowHours = 12): boolean {
    const schedule = t.releaseSchedule || t.cutoffTime;
    if (!schedule) return false;

    const scheduledAt = parseDailyHHMM(schedule, now);
    if (!scheduledAt) return false;

    // Already past today's slot?
    if (now.getTime() < scheduledAt.getTime()) return false;

    // Dedup: if we fired in the last dedupWindowHours, skip
    if (t.lastAutoReleasedAt) {
      const hoursSinceLast = (now.getTime() - t.lastAutoReleasedAt.getTime()) / (3600 * 1000);
      if (hoursSinceLast < dedupWindowHours) return false;
    }

    return true;
  }
}

/**
 * Parse a schedule string into today's scheduled Date. Supports:
 *  - "HH:MM" (24h, local UTC for v1)
 *  - Crontab form "MM HH * * *" (minute, hour only)
 *
 * Returns null for unsupported / invalid expressions.
 */
export function parseDailyHHMM(schedule: string, now: Date): Date | null {
  const hhmm = schedule.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    const out = new Date(now);
    out.setUTCHours(h, m, 0, 0);
    return out;
  }

  // Basic cron support: "M H * * *" where M and H are single numbers
  const cron = schedule.trim().match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (cron) {
    const m = Number(cron[1]);
    const h = Number(cron[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    const out = new Date(now);
    out.setUTCHours(h, m, 0, 0);
    return out;
  }

  return null;
}
