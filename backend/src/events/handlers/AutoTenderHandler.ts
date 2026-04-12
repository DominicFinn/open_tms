/**
 * AutoTenderHandler — automatically creates tenders for laneless shipments.
 *
 * When a shipment is created without a lane or carrier, and the org has
 * autoTenderEnabled = true, this handler creates a broadcast tender to
 * all active carriers, enabling competitive bidding.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class AutoTenderHandler implements IEventHandler {
  readonly name = 'auto_tender';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_CREATED,
  ];
  readonly options = { concurrency: 2, retryLimit: 3, expireInSeconds: 60 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== EVENT_TYPES.SHIPMENT_CREATED) return;

    const payload = event.payload as {
      shipmentReference: string;
      carrierId?: string;
      laneId?: string;
    };

    // Skip if shipment already has a carrier or lane
    if (payload.carrierId || payload.laneId) return;

    try {
      // Check org setting
      const org = await this.prisma.organization.findFirst({
        select: { autoTenderEnabled: true },
      });
      if (!org?.autoTenderEnabled) return;

      // Check that no tender already exists for this shipment
      const existingTender = await this.prisma.tender.findFirst({
        where: {
          shipmentId: event.entityId,
          status: { notIn: ['cancelled'] },
        },
      });
      if (existingTender) return;

      // Get all active carriers
      const carriers = await this.prisma.carrier.findMany({
        where: { archived: false },
        select: { id: true },
        take: 50,
      });

      if (carriers.length === 0) {
        console.log(`[AutoTenderHandler] No active carriers found, skipping auto-tender for shipment ${event.entityId}`);
        return;
      }

      // Generate tender reference
      const count = await this.prisma.tender.count();
      const tenderRef = `T-${String(count + 1).padStart(5, '0')}`;

      // Create tender with broadcast strategy
      const tender = await this.prisma.tender.create({
        data: {
          reference: tenderRef,
          shipmentId: event.entityId,
          strategy: 'broadcast',
          status: 'open',
          tenderDurationMinutes: 120, // 2 hours default
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 120 * 60_000),
          offers: {
            create: carriers.map((c) => ({
              carrierId: c.id,
              status: 'sent',
              sentAt: new Date(),
            })),
          },
        },
      });

      console.log(`[AutoTenderHandler] Auto-created broadcast tender ${tenderRef} for laneless shipment ${payload.shipmentReference} with ${carriers.length} carriers`);
    } catch (err) {
      console.error(`[AutoTenderHandler] Error creating auto-tender for shipment ${event.entityId}:`, (err as Error).message);
    }
  }
}
