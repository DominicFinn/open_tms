import { PrismaClient } from '@prisma/client';

export interface AnonymizationResult {
  scanned: number;
  anonymized: number;
  errors: number;
}

/**
 * Scrubs PII from carrier portal users whose carrier has been archived or
 * soft-deleted for longer than the retention window (default 1 year). Mirrors
 * how we retain soft-deleted rows for audit while removing personal data:
 * email/name are replaced with non-identifying placeholders, the account is
 * deactivated, and `anonymizedAt` is stamped so the row is skipped next time.
 *
 * See CLAUDE.md > carrier archival. Configurable via CARRIER_USER_ANONYMIZE_DAYS.
 */
export class CarrierUserAnonymizationService {
  constructor(
    private prisma: PrismaClient,
    private retentionDays = 365,
  ) {}

  async runOnce(): Promise<AnonymizationResult> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    // Users of carriers deleted or archived before the cutoff, not yet scrubbed.
    const candidates = await this.prisma.carrierUser.findMany({
      where: {
        anonymizedAt: null,
        carrier: {
          OR: [
            { deletedAt: { lt: cutoff } },
            { archived: true, archivedAt: { lt: cutoff } },
          ],
        },
      },
      select: { id: true },
      take: 500,
    });

    let anonymized = 0;
    let errors = 0;
    const now = new Date();
    for (const user of candidates) {
      try {
        await this.prisma.carrierUser.update({
          where: { id: user.id },
          data: {
            // email is @unique — keep it unique but non-identifying.
            email: `anonymized-${user.id}@removed.invalid`,
            name: 'Anonymized User',
            passwordHash: 'anonymized',
            active: false,
            anonymizedAt: now,
          },
        });
        anonymized++;
      } catch {
        errors++;
      }
    }

    return { scanned: candidates.length, anonymized, errors };
  }
}
