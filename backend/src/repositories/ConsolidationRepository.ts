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
  devices: { where: { active: true }, select: { id: true, device: { select: { id: true, name: true, externalId: true } } } },
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

export type ConsolidationDetail = Prisma.ConsolidationGetPayload<{ select: typeof detailSelect }> & {
  position: { lat: number; lng: number; at: Date | null } | null;
};

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
  memberShipmentIds(orgId: string, consolidationId: string): Promise<string[]>;
  consolidationIdForShipment(orgId: string, shipmentId: string): Promise<string | null>;
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
    const consolidation = await this.prisma.consolidation.findFirst({ where: { id, orgId }, select: detailSelect });
    if (!consolidation) return null;
    // Every shipment on the run is driven by the same pings, so the freshest of their positions is the truck's.
    const positions = await this.prisma.shipmentReadModel.findMany({
      where: { orgId, id: { in: consolidation.shipments.map((s) => s.shipment.id) }, lastLocationAt: { not: null } },
      orderBy: { lastLocationAt: 'desc' },
      take: 1,
      select: { currentLat: true, currentLng: true, lastLocationAt: true },
    });
    const p = positions[0];
    const position = p?.currentLat != null && p.currentLng != null ? { lat: p.currentLat, lng: p.currentLng, at: p.lastLocationAt } : null;
    return { ...consolidation, position };
  }

  /** The consolidation's live shipments in the order they were added: who a ping on its device updates. */
  async memberShipmentIds(orgId: string, consolidationId: string): Promise<string[]> {
    const rows = await this.prisma.consolidationShipment.findMany({
      where: { consolidationId, consolidation: { orgId }, shipment: { orgId, archived: false } },
      orderBy: { addedAt: 'asc' },
      select: { shipmentId: true },
    });
    return rows.map((r) => r.shipmentId);
  }

  async consolidationIdForShipment(orgId: string, shipmentId: string): Promise<string | null> {
    const row = await this.prisma.consolidationShipment.findFirst({
      where: { shipmentId, shipment: { orgId } },
      select: { consolidationId: true },
    });
    return row?.consolidationId ?? null;
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
