import { Prisma, PrismaClient, ConsolidationReadModel } from '@prisma/client';

const detailSelect = {
  id: true,
  reference: true,
  status: true,
  notes: true,
  carrierRateCents: true,
  currency: true,
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
      purpose: true,
      label: true,
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

export interface ShipmentCost {
  shipmentId: string;
  weightKg: number;
  /** This shipment's share of the run's carrier rate, when one is set. */
  shareCents: number | null;
  shareStatus: string | null;
  revenueCents: number;
  costCents: number;
  marginCents: number;
}

export type ConsolidationDetail = Prisma.ConsolidationGetPayload<{ select: typeof detailSelect }> & {
  position: { lat: number; lng: number; at: Date | null } | null;
  costs: ShipmentCost[];
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
const LB_TO_KG = 0.453592;

type ShipmentWeightSource = Pick<PrismaClient, 'orderShipment'>;

/**
 * Each shipment's freight weight in kg: the weight times quantity of every line on its orders,
 * pounds converted. Shipments with no weighed lines come back as 0. Takes a transaction client too,
 * so cost allocation reads the same numbers the page shows.
 */
export async function loadShipmentWeightsKg(db: ShipmentWeightSource, orgId: string, shipmentIds: string[]): Promise<Map<string, number>> {
  const links = await db.orderShipment.findMany({
    where: { shipmentId: { in: shipmentIds }, order: { orgId } },
    select: { shipmentId: true, order: { select: { lineItems: { select: { weight: true, weightUnit: true, quantity: true } } } } },
  });
  const weights = new Map(shipmentIds.map((id) => [id, 0]));
  for (const link of links) {
    const kg = link.order.lineItems.reduce((sum, li) => sum + (li.weight ?? 0) * (li.weightUnit === 'lb' ? LB_TO_KG : 1) * li.quantity, 0);
    weights.set(link.shipmentId, (weights.get(link.shipmentId) ?? 0) + kg);
  }
  return weights;
}

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
    return { ...consolidation, position, costs: await this.shipmentCosts(orgId, id, consolidation.shipments.map((s) => s.shipment.id)) };
  }

  /** Each shipment's weight, its share of the run's rate, and its expected margin (#329). */
  private async shipmentCosts(orgId: string, consolidationId: string, shipmentIds: string[]): Promise<ShipmentCost[]> {
    if (shipmentIds.length === 0) return [];
    const [weights, shares, summaries] = await Promise.all([
      loadShipmentWeightsKg(this.prisma, orgId, shipmentIds),
      this.prisma.charge.findMany({
        where: { orgId, shipmentId: { in: shipmentIds }, source: 'consolidation', sourceId: consolidationId },
        select: { shipmentId: true, amountCents: true, status: true },
      }),
      this.prisma.shipmentFinancialSummary.findMany({
        where: { orgId, shipmentId: { in: shipmentIds } },
        select: { shipmentId: true, expectedRevenueCents: true, expectedCostCents: true, expectedMarginCents: true },
      }),
    ]);
    return shipmentIds.map((shipmentId) => {
      const share = shares.find((c) => c.shipmentId === shipmentId);
      const summary = summaries.find((s) => s.shipmentId === shipmentId);
      return {
        shipmentId,
        weightKg: Math.round((weights.get(shipmentId) ?? 0) * 10) / 10,
        shareCents: share?.amountCents ?? null,
        shareStatus: share?.status ?? null,
        revenueCents: summary?.expectedRevenueCents ?? 0,
        costCents: summary?.expectedCostCents ?? 0,
        marginCents: summary?.expectedMarginCents ?? 0,
      };
    });
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
