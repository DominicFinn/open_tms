import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ICommandBus } from '../commands/CommandBus.js';
import { ARCHIVE_ORDER } from '../commands/orders/ArchiveOrderCommand.js';

export interface AutoArchiveResult {
  scanned: number;
  archived: number;
  errors: number;
}

/**
 * Auto-archives orders that have been delivered or cancelled for longer than
 * the configured retention window. See CLAUDE.md > "Order Archival Policy".
 */
export class OrderAutoArchiveService {
  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
    private retentionDays = 30,
  ) {}

  async runOnce(): Promise<AutoArchiveResult> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.order.findMany({
      where: {
        archived: false,
        OR: [
          { deliveryStatus: 'delivered', deliveredAt: { lt: cutoff } },
          { status: 'cancelled', updatedAt: { lt: cutoff } },
          { deliveryStatus: 'cancelled', updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, orgId: true },
      take: 500,
    });

    let archived = 0;
    let errors = 0;
    for (const order of candidates) {
      const result = await this.commandBus.dispatch({
        type: ARCHIVE_ORDER,
        orgId: order.orgId,
        actorId: null,
        payload: { id: order.id },
        metadata: { correlationId: randomUUID(), source: 'auto-archive' },
      });
      if (result.success) archived++;
      else errors++;
    }

    return { scanned: candidates.length, archived, errors };
  }
}
