import { Prisma, PrismaClient, ConsolidationReadModel } from '@prisma/client';

const detailSelect = {
  id: true,
  reference: true,
  status: true,
  notes: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
  carrier: { select: { id: true, name: true } },
  stops: {
    orderBy: { sequenceNumber: 'asc' },
    select: {
      id: true,
      sequenceNumber: true,
      stopType: true,
      status: true,
      location: { select: { id: true, name: true, city: true, state: true, lat: true, lng: true } },
      shipmentStops: { select: { shipmentId: true } },
    },
  },
  shipments: {
    orderBy: { addedAt: 'asc' },
    select: {
      addedAt: true,
      shipment: {
        select: {
          id: true,
          reference: true,
          status: true,
          serviceLevel: true,
          pickupDate: true,
          deliveryDate: true,
          customer: { select: { id: true, name: true } },
          stops: { orderBy: { sequenceNumber: 'asc' }, select: { id: true, sequenceNumber: true, stopType: true, status: true, consolidationStopId: true } },
        },
      },
    },
  },
} satisfies Prisma.ConsolidationSelect;

export type ConsolidationDetail = Prisma.ConsolidationGetPayload<{ select: typeof detailSelect }>;

export interface ConsolidationCandidate {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  originName: string | null;
  destinationName: string | null;
  pickupDate: Date | null;
}

const OPEN_SHIPMENT_STATUSES = ['draft', 'ready'];

export interface IConsolidationRepository {
  list(orgId: string, opts: { archived: boolean; limit: number; offset: number }): Promise<{ items: ConsolidationReadModel[]; total: number }>;
  findDetail(orgId: string, id: string): Promise<ConsolidationDetail | null>;
  listCandidates(orgId: string, search: string | undefined, limit: number): Promise<ConsolidationCandidate[]>;
}

export class ConsolidationRepository implements IConsolidationRepository {
  constructor(private prisma: PrismaClient) {}

  async list(orgId: string, opts: { archived: boolean; limit: number; offset: number }) {
    const where = { orgId, archived: opts.archived };
    const [items, total] = await Promise.all([
      this.prisma.consolidationReadModel.findMany({ where, orderBy: { createdAt: 'desc' }, take: opts.limit, skip: opts.offset }),
      this.prisma.consolidationReadModel.count({ where }),
    ]);
    return { items, total };
  }

  async findDetail(orgId: string, id: string) {
    return this.prisma.consolidation.findFirst({ where: { id, orgId }, select: detailSelect });
  }

  /** Shipments that could join a consolidation: open, not archived, not on one already. */
  async listCandidates(orgId: string, search: string | undefined, limit: number): Promise<ConsolidationCandidate[]> {
    const rows = await this.prisma.shipment.findMany({
      where: {
        orgId,
        archived: false,
        status: { in: OPEN_SHIPMENT_STATUSES },
        consolidationShipment: { is: null },
        ...(search ? { reference: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        reference: true,
        status: true,
        pickupDate: true,
        customer: { select: { name: true } },
        origin: { select: { name: true } },
        destination: { select: { name: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      customerName: r.customer.name,
      originName: r.origin?.name ?? null,
      destinationName: r.destination?.name ?? null,
      pickupDate: r.pickupDate,
    }));
  }
}
