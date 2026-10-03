import { PrismaClient, Tender, TenderOffer, TenderBid } from '@prisma/client';

export interface CreateTenderDTO {
  shipmentId: string;
  reference: string;
  strategy: string;
  tenderDurationMinutes: number;
  targetRate?: number;
  currency?: string;
  equipmentType?: string;
  notes?: string;
  specialInstructions?: string;
  createdBy?: string;
}

export interface CreateTenderOfferDTO {
  tenderId: string;
  carrierId: string;
  sequence?: number;
}

export interface CreateTenderBidDTO {
  tenderId: string;
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

export interface TenderFilters {
  /** Omit only for the org-wide expiry sweep. Every request path passes it. */
  orgId?: string;
  status?: string;
  strategy?: string;
  shipmentId?: string;
  carrierId?: string;
}

// Full tender with relations
export type TenderWithRelations = Tender & {
  shipment: {
    id: string;
    reference: string;
    status: string;
    pickupDate: Date | null;
    deliveryDate: Date | null;
    orgId: string;
    customerId: string;
    originId: string;
    destinationId: string;
    customer: { id: string; name: string };
    origin: { id: string; name: string; city: string; state: string | null };
    destination: { id: string; name: string; city: string; state: string | null };
  };
  offers: (TenderOffer & {
    carrier: { id: string; name: string; scacCode: string | null; contactEmail: string | null };
    bids: TenderBid[];
  })[];
  bids: (TenderBid & {
    carrier: { id: string; name: string };
  })[];
};

export interface ITenderRepository {
  create(data: CreateTenderDTO): Promise<Tender>;
  findById(id: string, orgId: string): Promise<TenderWithRelations | null>;
  findAll(filters?: TenderFilters): Promise<TenderWithRelations[]>;
  findByShipmentId(shipmentId: string, orgId: string): Promise<TenderWithRelations[]>;
  update(id: string, orgId: string, data: Partial<Tender>): Promise<Tender>;
  getNextReference(): Promise<string>;

  // Offers
  createOffer(data: CreateTenderOfferDTO): Promise<TenderOffer>;
  findOfferById(id: string, orgId: string): Promise<TenderOffer | null>;
  findOffersByTenderId(tenderId: string, orgId: string): Promise<TenderOffer[]>;
  findActiveOffersForCarrier(carrierId: string, orgId: string): Promise<(TenderOffer & { tender: TenderWithRelations })[]>;
  findAllOffersForCarrier(carrierId: string, orgId: string): Promise<any[]>;
  updateOffer(id: string, orgId: string, data: Partial<TenderOffer>): Promise<TenderOffer>;
  findExpiredOffers(): Promise<ExpiredTenderOffer[]>;

  // Bids
  createBid(data: CreateTenderBidDTO): Promise<TenderBid>;
  findBidById(id: string, orgId: string): Promise<TenderBid | null>;
  findBidsByTenderId(tenderId: string, orgId: string): Promise<TenderBid[]>;
  findBidsByCarrierId(carrierId: string, orgId: string): Promise<TenderBid[]>;
  updateBid(id: string, orgId: string, data: Partial<TenderBid>): Promise<TenderBid>;
}

export type ExpiredTenderOffer = TenderOffer & {
  tender: Tender & { shipment: { orgId: string } };
};

const tenderInclude = {
  shipment: {
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { id: true, name: true, city: true, state: true } },
      destination: { select: { id: true, name: true, city: true, state: true } },
    },
  },
  offers: {
    include: {
      carrier: { select: { id: true, name: true, scacCode: true, contactEmail: true } },
      bids: true,
    },
    orderBy: { sequence: 'asc' as const },
  },
  bids: {
    include: {
      carrier: { select: { id: true, name: true } },
    },
    orderBy: { submittedAt: 'desc' as const },
  },
};

export class TenderRepository implements ITenderRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateTenderDTO): Promise<Tender> {
    return this.prisma.tender.create({ data });
  }

  async findById(id: string, orgId: string): Promise<TenderWithRelations | null> {
    return this.prisma.tender.findUnique({
      where: { id, shipment: { orgId } },
      include: tenderInclude,
    }) as Promise<TenderWithRelations | null>;
  }

  async findAll(filters?: TenderFilters): Promise<TenderWithRelations[]> {
    const where: any = {};
    if (filters?.orgId) where.shipment = { orgId: filters.orgId };
    if (filters?.status) where.status = filters.status;
    if (filters?.strategy) where.strategy = filters.strategy;
    if (filters?.shipmentId) where.shipmentId = filters.shipmentId;
    if (filters?.carrierId) {
      where.offers = { some: { carrierId: filters.carrierId } };
    }

    return this.prisma.tender.findMany({
      where,
      include: tenderInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<TenderWithRelations[]>;
  }

  async findByShipmentId(shipmentId: string, orgId: string): Promise<TenderWithRelations[]> {
    return this.findAll({ shipmentId, orgId });
  }

  async update(id: string, orgId: string, data: Partial<Tender>): Promise<Tender> {
    return this.prisma.tender.update({ where: { id, shipment: { orgId } }, data: data as any });
  }

  async getNextReference(): Promise<string> {
    // tenancy-exempt: the tender reference is unique across every org, so the sequence reads the latest reference table-wide and returns nothing else.
    const last = await this.prisma.tender.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { reference: true },
    });
    if (!last) return 'TND-001';
    const num = parseInt(last.reference.replace('TND-', ''), 10);
    return `TND-${String(num + 1).padStart(3, '0')}`;
  }

  // ── Offers ──

  async createOffer(data: CreateTenderOfferDTO): Promise<TenderOffer> {
    return this.prisma.tenderOffer.create({ data });
  }

  async findOfferById(id: string, orgId: string): Promise<TenderOffer | null> {
    return this.prisma.tenderOffer.findUnique({
      where: { id, tender: { shipment: { orgId } } },
      include: {
        carrier: { select: { id: true, name: true, scacCode: true, contactEmail: true } },
        bids: true,
        tender: true,
      },
    });
  }

  async findOffersByTenderId(tenderId: string, orgId: string): Promise<TenderOffer[]> {
    return this.prisma.tenderOffer.findMany({
      where: { tenderId, tender: { shipment: { orgId } } },
      include: {
        carrier: { select: { id: true, name: true, scacCode: true, contactEmail: true } },
        bids: true,
      },
      orderBy: { sequence: 'asc' },
    });
  }

  async findActiveOffersForCarrier(carrierId: string, orgId: string): Promise<any[]> {
    return this.prisma.tenderOffer.findMany({
      where: {
        carrierId,
        status: { in: ['sent', 'viewed'] },
        tender: { status: 'open', shipment: { orgId } },
      },
      include: {
        tender: {
          include: tenderInclude,
        },
      },
      orderBy: { sentAt: 'desc' },
    });
  }

  async findAllOffersForCarrier(carrierId: string, orgId: string): Promise<any[]> {
    return this.prisma.tenderOffer.findMany({
      where: { carrierId, tender: { shipment: { orgId } } },
      include: {
        bids: true,
        tender: {
          include: {
            shipment: {
              include: {
                customer: { select: { id: true, name: true } },
                origin: { select: { id: true, name: true, city: true, state: true } },
                destination: { select: { id: true, name: true, city: true, state: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOffer(id: string, orgId: string, data: Partial<TenderOffer>): Promise<TenderOffer> {
    return this.prisma.tenderOffer.update({ where: { id, tender: { shipment: { orgId } } }, data: data as any });
  }

  async findExpiredOffers(): Promise<ExpiredTenderOffer[]> {
    // tenancy-exempt: the tender expiry cron sweeps every org on purpose, and each follow-up write uses the org of the offer's shipment.
    return this.prisma.tenderOffer.findMany({
      where: {
        status: { in: ['sent', 'viewed'] },
        expiresAt: { lte: new Date() },
      },
      include: {
        tender: { include: { shipment: { select: { orgId: true } } } },
      },
    });
  }

  // ── Bids ──

  async createBid(data: CreateTenderBidDTO): Promise<TenderBid> {
    return this.prisma.tenderBid.create({ data });
  }

  async findBidById(id: string, orgId: string): Promise<TenderBid | null> {
    return this.prisma.tenderBid.findUnique({
      where: { id, tender: { shipment: { orgId } } },
      include: {
        carrier: { select: { id: true, name: true } },
        tenderOffer: true,
        tender: true,
      },
    });
  }

  async findBidsByTenderId(tenderId: string, orgId: string): Promise<TenderBid[]> {
    return this.prisma.tenderBid.findMany({
      where: { tenderId, tender: { shipment: { orgId } } },
      include: {
        carrier: { select: { id: true, name: true } },
      },
      orderBy: { rate: 'asc' },
    });
  }

  async findBidsByCarrierId(carrierId: string, orgId: string): Promise<TenderBid[]> {
    return this.prisma.tenderBid.findMany({
      where: { carrierId, tender: { shipment: { orgId } } },
      include: {
        tender: {
          select: { id: true, reference: true, status: true, shipmentId: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async updateBid(id: string, orgId: string, data: Partial<TenderBid>): Promise<TenderBid> {
    return this.prisma.tenderBid.update({ where: { id, tender: { shipment: { orgId } } }, data: data as any });
  }
}
