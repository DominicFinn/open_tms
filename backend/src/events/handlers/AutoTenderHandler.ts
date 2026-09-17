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
      // The setting, the shipment and the carriers all belong to the event's org. A shipment that
      // isn't in that org is ignored rather than tendered to another tenant's carriers.
      const org = await this.prisma.organization.findUnique({
        where: { id: event.orgId },
        select: { autoTenderEnabled: true },
      });
      if (!org?.autoTenderEnabled) return;

      const shipment = await this.prisma.shipment.findFirst({
        where: { id: event.entityId, orgId: event.orgId },
        select: { id: true },
      });
      if (!shipment) return;

      // Check that no tender already exists for this shipment
      const existingTender = await this.prisma.tender.findFirst({
        where: {
          shipmentId: shipment.id,
          shipment: { orgId: event.orgId },
          status: { notIn: ['cancelled'] },
        },
      });
      if (existingTender) return;

      const carriers = await this.prisma.carrier.findMany({
        where: { orgId: event.orgId, archived: false },
        select: { id: true },
        take: 50,
      });

      if (carriers.length === 0) {
        console.log(`[AutoTenderHandler] No active carriers found, skipping auto-tender for shipment ${event.entityId}`);
        return;
      }

      // Tender references are unique across every org, so they cannot come from a per-org count,
      // and a table-wide count would reveal other tenants' tender volume.
      const tenderRef = `T-${Date.now()}`;

      // Create tender with broadcast strategy. Mirrors TenderService.openTender:
      // the open time lives on the tender, the expiry on each offer.
      const now = new Date();
      const durationMinutes = 120; // 2 hours default
      const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);

      await this.prisma.tender.create({
        data: {
          reference: tenderRef,
          shipmentId: event.entityId,
          strategy: 'broadcast',
          status: 'open',
          tenderDurationMinutes: durationMinutes,
          openedAt: now,
          offers: {
            create: carriers.map((c) => ({
              carrierId: c.id,
              status: 'sent',
              sentAt: now,
              expiresAt,
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
