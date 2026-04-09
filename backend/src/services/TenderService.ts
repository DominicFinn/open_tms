import { PrismaClient } from '@prisma/client';
import { ITenderRepository, TenderWithRelations, CreateTenderBidDTO } from '../repositories/TenderRepository.js';
import { IOutboundEdiDeliveryService } from './OutboundEdiDeliveryService.js';
import { EDI204Service, EDI204ShipmentData } from './EDI204Service.js';

export interface CreateTenderInput {
  shipmentId: string;
  strategy: 'broadcast' | 'waterfall';
  carrierIds: string[];
  tenderDurationMinutes?: number;
  targetRate?: number;
  currency?: string;
  equipmentType?: string;
  notes?: string;
  specialInstructions?: string;
  createdBy?: string;
}

export interface SubmitBidInput {
  tenderOfferId: string;
  carrierId: string;
  rate: number;
  currency?: string;
  transitDays?: number;
  equipmentType?: string;
  notes?: string;
  submittedById?: string;
  sourceType?: string;
  edi990Content?: string;
}

export interface ITenderService {
  createTender(input: CreateTenderInput): Promise<TenderWithRelations>;
  openTender(tenderId: string): Promise<TenderWithRelations>;
  submitBid(input: SubmitBidInput): Promise<any>;
  awardTender(tenderId: string, bidId: string): Promise<TenderWithRelations>;
  cancelTender(tenderId: string): Promise<TenderWithRelations>;
  declineTenderOffer(tenderOfferId: string, carrierId: string): Promise<void>;
  checkExpiredOffers(): Promise<number>;
  getActiveTendersForCarrier(carrierId: string): Promise<any[]>;
  getTenderForCarrier(tenderId: string, carrierId: string): Promise<any>;
}

export class TenderService implements ITenderService {
  private edi204Service = new EDI204Service();

  constructor(
    private tenderRepo: ITenderRepository,
    private prisma: PrismaClient,
    private outboundDelivery?: IOutboundEdiDeliveryService,
  ) {}

  async createTender(input: CreateTenderInput): Promise<TenderWithRelations> {
    const reference = await this.tenderRepo.getNextReference();

    // Validate shipment exists
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: input.shipmentId },
    });
    if (!shipment) throw new Error('Shipment not found');

    // Create tender
    const tender = await this.tenderRepo.create({
      shipmentId: input.shipmentId,
      reference,
      strategy: input.strategy,
      tenderDurationMinutes: input.tenderDurationMinutes ?? 120,
      targetRate: input.targetRate,
      currency: input.currency,
      equipmentType: input.equipmentType,
      notes: input.notes,
      specialInstructions: input.specialInstructions,
      createdBy: input.createdBy,
    });

    // Create offers for each carrier
    for (let i = 0; i < input.carrierIds.length; i++) {
      await this.tenderRepo.createOffer({
        tenderId: tender.id,
        carrierId: input.carrierIds[i],
        sequence: i + 1,
      });
    }

    return (await this.tenderRepo.findById(tender.id))!;
  }

  async openTender(tenderId: string): Promise<TenderWithRelations> {
    const tender = await this.tenderRepo.findById(tenderId);
    if (!tender) throw new Error('Tender not found');
    if (tender.status !== 'draft') throw new Error('Tender can only be opened from draft status');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + tender.tenderDurationMinutes * 60 * 1000);

    // Update tender status
    await this.tenderRepo.update(tenderId, {
      status: 'open',
      openedAt: now,
    } as any);

    if (tender.strategy === 'broadcast') {
      // Broadcast: send to all carriers at once
      for (const offer of tender.offers) {
        await this.tenderRepo.updateOffer(offer.id, {
          status: 'sent',
          sentAt: now,
          expiresAt,
        } as any);
        // Auto-deliver EDI 204 if carrier has a trading partner configured
        await this.autoDeliverEdi204(tender, offer);
      }
    } else {
      // Waterfall: only send to first carrier
      const firstOffer = tender.offers.find(o => o.sequence === 1);
      if (firstOffer) {
        await this.tenderRepo.updateOffer(firstOffer.id, {
          status: 'sent',
          sentAt: now,
          expiresAt,
        } as any);
        await this.autoDeliverEdi204(tender, firstOffer);
      }
    }

    return (await this.tenderRepo.findById(tenderId))!;
  }

  async submitBid(input: SubmitBidInput): Promise<any> {
    // Validate the offer exists and is active
    const offer = await this.tenderRepo.findOfferById(input.tenderOfferId);
    if (!offer) throw new Error('Tender offer not found');
    if (!['sent', 'viewed'].includes(offer.status)) {
      throw new Error('This tender offer is no longer accepting bids');
    }

    // Check tender is still open
    const tender = await this.tenderRepo.findById((offer as any).tenderId);
    if (!tender || tender.status !== 'open') {
      throw new Error('Tender is no longer open');
    }

    // Check carrier matches offer
    if (offer.carrierId !== input.carrierId) {
      throw new Error('Carrier does not match this tender offer');
    }

    // Create the bid
    const bid = await this.tenderRepo.createBid({
      tenderId: tender.id,
      tenderOfferId: input.tenderOfferId,
      carrierId: input.carrierId,
      rate: input.rate,
      currency: input.currency,
      transitDays: input.transitDays,
      equipmentType: input.equipmentType,
      notes: input.notes,
      submittedById: input.submittedById,
      sourceType: input.sourceType ?? 'portal',
      edi990Content: input.edi990Content,
    });

    return bid;
  }

  async awardTender(tenderId: string, bidId: string): Promise<TenderWithRelations> {
    const tender = await this.tenderRepo.findById(tenderId);
    if (!tender) throw new Error('Tender not found');
    if (!['open', 'evaluating'].includes(tender.status)) {
      throw new Error('Tender is not in a state that can be awarded');
    }

    const winningBid = await this.tenderRepo.findBidById(bidId);
    if (!winningBid) throw new Error('Bid not found');
    if ((winningBid as any).tenderId !== tenderId) throw new Error('Bid does not belong to this tender');

    const now = new Date();

    // Accept the winning bid
    await this.tenderRepo.updateBid(bidId, {
      status: 'accepted',
      respondedAt: now,
    } as any);

    // Reject all other bids
    for (const bid of tender.bids) {
      if (bid.id !== bidId && bid.status === 'submitted') {
        await this.tenderRepo.updateBid(bid.id, {
          status: 'rejected',
          respondedAt: now,
        } as any);
      }
    }

    // Cancel any pending/sent offers that haven't bid
    for (const offer of tender.offers) {
      if (['pending', 'sent', 'viewed'].includes(offer.status)) {
        await this.tenderRepo.updateOffer(offer.id, {
          status: 'cancelled',
        } as any);
      }
    }

    // Update tender status
    await this.tenderRepo.update(tenderId, {
      status: 'awarded',
      awardedAt: now,
      closedAt: now,
    } as any);

    // Assign carrier to shipment
    await this.prisma.shipment.update({
      where: { id: tender.shipmentId },
      data: { carrierId: winningBid.carrierId },
    });

    return (await this.tenderRepo.findById(tenderId))!;
  }

  async cancelTender(tenderId: string): Promise<TenderWithRelations> {
    const tender = await this.tenderRepo.findById(tenderId);
    if (!tender) throw new Error('Tender not found');
    if (['awarded', 'cancelled'].includes(tender.status)) {
      throw new Error('Tender cannot be cancelled in current state');
    }

    const now = new Date();

    // Cancel all pending offers
    for (const offer of tender.offers) {
      if (['pending', 'sent', 'viewed'].includes(offer.status)) {
        await this.tenderRepo.updateOffer(offer.id, {
          status: 'cancelled',
        } as any);
      }
    }

    // Expire all submitted bids
    for (const bid of tender.bids) {
      if (bid.status === 'submitted') {
        await this.tenderRepo.updateBid(bid.id, {
          status: 'expired',
        } as any);
      }
    }

    await this.tenderRepo.update(tenderId, {
      status: 'cancelled',
      closedAt: now,
    } as any);

    return (await this.tenderRepo.findById(tenderId))!;
  }

  async declineTenderOffer(tenderOfferId: string, carrierId: string): Promise<void> {
    const offer = await this.tenderRepo.findOfferById(tenderOfferId);
    if (!offer) throw new Error('Tender offer not found');
    if (offer.carrierId !== carrierId) throw new Error('Carrier does not match this offer');

    await this.tenderRepo.updateOffer(tenderOfferId, {
      status: 'expired',
    } as any);

    // For waterfall tenders, progress to next carrier
    const tender = await this.tenderRepo.findById((offer as any).tenderId);
    if (tender && tender.strategy === 'waterfall') {
      await this.progressWaterfall(tender.id);
    }
  }

  async checkExpiredOffers(): Promise<number> {
    const expiredOffers = await this.tenderRepo.findExpiredOffers();
    let count = 0;

    for (const offer of expiredOffers) {
      await this.tenderRepo.updateOffer(offer.id, {
        status: 'expired',
      } as any);
      count++;

      // For waterfall tenders, activate next carrier
      const tender = offer as any;
      if (tender.tender?.strategy === 'waterfall') {
        await this.progressWaterfall(tender.tender.id);
      }
    }

    // Check for broadcast tenders where all offers expired with no bids
    if (count > 0) {
      await this.checkFullyExpiredTenders();
    }

    return count;
  }

  private async progressWaterfall(tenderId: string): Promise<void> {
    const tender = await this.tenderRepo.findById(tenderId);
    if (!tender || tender.status !== 'open') return;

    // Find next pending offer in sequence
    const nextOffer = tender.offers
      .filter(o => o.status === 'pending')
      .sort((a, b) => a.sequence - b.sequence)[0];

    if (nextOffer) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + tender.tenderDurationMinutes * 60 * 1000);
      await this.tenderRepo.updateOffer(nextOffer.id, {
        status: 'sent',
        sentAt: now,
        expiresAt,
      } as any);
      await this.autoDeliverEdi204(tender, nextOffer);
    } else {
      // No more carriers to try — check if we have any bids
      const hasBids = tender.bids.some(b => b.status === 'submitted');
      if (hasBids) {
        await this.tenderRepo.update(tenderId, { status: 'evaluating' } as any);
      } else {
        await this.tenderRepo.update(tenderId, {
          status: 'expired',
          closedAt: new Date(),
        } as any);
      }
    }
  }

  private async checkFullyExpiredTenders(): Promise<void> {
    // Find open broadcast tenders where all offers are expired and no submitted bids exist
    const openTenders = await this.tenderRepo.findAll({ status: 'open' });
    for (const tender of openTenders) {
      if (tender.strategy !== 'broadcast') continue;

      const allExpiredOrCancelled = tender.offers.every(o =>
        ['expired', 'cancelled'].includes(o.status)
      );
      const hasSubmittedBids = tender.bids.some(b => b.status === 'submitted');

      if (allExpiredOrCancelled) {
        if (hasSubmittedBids) {
          await this.tenderRepo.update(tender.id, { status: 'evaluating' } as any);
        } else {
          await this.tenderRepo.update(tender.id, {
            status: 'expired',
            closedAt: new Date(),
          } as any);
        }
      }
    }
  }

  async getActiveTendersForCarrier(carrierId: string): Promise<any[]> {
    return this.tenderRepo.findActiveOffersForCarrier(carrierId);
  }

  async getTenderForCarrier(tenderId: string, carrierId: string): Promise<any> {
    const tender = await this.tenderRepo.findById(tenderId);
    if (!tender) throw new Error('Tender not found');

    const offer = tender.offers.find(o => o.carrierId === carrierId);
    if (!offer) throw new Error('No offer found for this carrier');

    // Mark as viewed if first time
    if (offer.status === 'sent') {
      await this.tenderRepo.updateOffer(offer.id, {
        status: 'viewed',
        viewedAt: new Date(),
      } as any);
    }

    return { tender, offer };
  }

  /**
   * Auto-deliver EDI 204 to a carrier if they have a TradingPartner with outbound 204 enabled.
   * Called automatically when a tender offer is sent (broadcast or waterfall).
   */
  private async autoDeliverEdi204(tender: TenderWithRelations, offer: any): Promise<void> {
    if (!this.outboundDelivery) return;

    try {
      // Load shipment details for EDI 204 generation
      const shipment: any = await this.prisma.shipment.findUnique({
        where: { id: tender.shipmentId },
        include: {
          origin: true,
          destination: true,
          stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        },
      });
      if (!shipment) return;

      const carrierScac = offer.carrier?.scacCode || 'UNKN';
      const mustRespondBy = new Date(Date.now() + tender.tenderDurationMinutes * 60 * 1000);

      const edi204Data: EDI204ShipmentData = {
        shipmentReference: shipment.reference,
        pickupDate: shipment.pickupDate,
        deliveryDate: shipment.deliveryDate,
        origin: {
          name: shipment.origin.name,
          address1: shipment.origin.address1,
          address2: shipment.origin.address2,
          city: shipment.origin.city,
          state: shipment.origin.state,
          postalCode: shipment.origin.postalCode,
          country: shipment.origin.country,
        },
        destination: {
          name: shipment.destination.name,
          address1: shipment.destination.address1,
          address2: shipment.destination.address2,
          city: shipment.destination.city,
          state: shipment.destination.state,
          postalCode: shipment.destination.postalCode,
          country: shipment.destination.country,
        },
        carrierScac,
        mustRespondBy,
        equipmentType: tender.equipmentType || undefined,
        specialInstructions: tender.specialInstructions || undefined,
      };

      const ediContent = this.edi204Service.generateEDI204(edi204Data);

      // Attempt delivery via TradingPartner
      const result = await this.outboundDelivery.deliverToCarrier(
        offer.carrierId,
        '204',
        ediContent,
        tender.reference,
        { shipmentId: tender.shipmentId, tenderId: tender.id },
      );

      if (result?.success) {
        // Mark the offer as EDI-sent
        await this.tenderRepo.updateOffer(offer.id, {
          ediSent: true,
          edi204Content: ediContent,
        } as any);
      } else if (result) {
        // Delivery attempted but failed — store content anyway for manual retry
        await this.tenderRepo.updateOffer(offer.id, {
          edi204Content: ediContent,
        } as any);
      }
      // If result is null, carrier has no TradingPartner — that's fine, they use the web portal
    } catch (err) {
      // EDI delivery failure should not block the tender from opening
      // The offer is still marked as 'sent' for the web portal
      console.error(`Auto EDI 204 delivery failed for offer ${offer.id}:`, err);
    }
  }
}
