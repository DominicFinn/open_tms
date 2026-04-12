import { PrismaClient } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface RateRequest {
  laneId?: string;
  carrierId?: string;
  serviceLevel: string; // FTL or LTL
  originId?: string;
  destinationId?: string;
  totalWeightKg?: number;
  items?: RateRequestItem[];
}

export interface RateRequestItem {
  weight?: number;
  weightUnit?: string;
  quantity: number;
  freightClass?: string;
  nmfcCode?: string;
  length?: number;
  width?: number;
  height?: number;
  dimUnit?: string;
}

export interface RateBreakdown {
  linehaulCents: number;
  fuelSurchargeCents: number;
  accessorialsCents: number;
  totalCents: number;
  currency: string;
  rateType: string;
  details: RateLineItem[];
}

export interface RateLineItem {
  chargeType: string;
  description: string;
  amountCents: number;
  accessorialCode?: string;
  freightClass?: string;
  ratePerCwt?: number;
  weight?: number;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IRatingService {
  calculateRate(request: RateRequest): Promise<RateBreakdown>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class RatingService implements IRatingService {
  constructor(private prisma: PrismaClient) {}

  async calculateRate(request: RateRequest): Promise<RateBreakdown> {
    const details: RateLineItem[] = [];
    let linehaulCents = 0;
    let fuelSurchargeCents = 0;
    let rateType = 'flat';
    const currency = 'USD';

    // Find the LaneCarrier rate
    const laneCarrier = await this.findLaneCarrier(request);

    if (!laneCarrier) {
      return {
        linehaulCents: 0,
        fuelSurchargeCents: 0,
        accessorialsCents: 0,
        totalCents: 0,
        currency,
        rateType: 'none',
        details: [],
      };
    }

    rateType = laneCarrier.rateType ?? 'flat';

    // Calculate linehaul based on rate type
    if (rateType === 'flat') {
      linehaulCents = laneCarrier.priceCents ?? Math.round((laneCarrier.price ?? 0) * 100);
    } else if (rateType === 'per_mile' && laneCarrier.lane) {
      const distanceKm = laneCarrier.lane.distance ?? 0;
      const distanceMiles = distanceKm * 0.621371;
      const pricePerMileCents = laneCarrier.priceCents ?? Math.round((laneCarrier.price ?? 0) * 100);
      linehaulCents = Math.round(distanceMiles * pricePerMileCents / 100);
    } else if (rateType === 'cwt' && request.totalWeightKg) {
      const weightLbs = request.totalWeightKg * 2.20462;
      const cwt = weightLbs / 100;
      const pricePerCwtCents = laneCarrier.priceCents ?? Math.round((laneCarrier.price ?? 0) * 100);
      linehaulCents = Math.round(cwt * pricePerCwtCents);
    }

    details.push({
      chargeType: 'linehaul',
      description: `Linehaul (${rateType})`,
      amountCents: linehaulCents,
    });

    // Apply fuel surcharge
    if (laneCarrier.fuelSurchargePercent && laneCarrier.fuelSurchargePercent > 0) {
      fuelSurchargeCents = Math.round(linehaulCents * laneCarrier.fuelSurchargePercent / 100);
      details.push({
        chargeType: 'fuel_surcharge',
        description: `Fuel surcharge (${laneCarrier.fuelSurchargePercent}%)`,
        amountCents: fuelSurchargeCents,
      });
    }

    // Calculate accessorials total
    let accessorialsCents = 0;
    const accessorialRates = laneCarrier.accessorialRates as Record<string, number> | null;
    if (accessorialRates) {
      // Accessorials are stored as { "detention": 50, "lumper": 75 } in dollars
      // We only include them if explicitly requested - for now just return available rates
      // Individual accessorials are added via ChargeService when they occur
    }

    const totalCents = linehaulCents + fuelSurchargeCents + accessorialsCents;

    return {
      linehaulCents,
      fuelSurchargeCents,
      accessorialsCents,
      totalCents,
      currency,
      rateType,
      details,
    };
  }

  private async findLaneCarrier(request: RateRequest) {
    if (request.laneId && request.carrierId) {
      return this.prisma.laneCarrier.findFirst({
        where: {
          laneId: request.laneId,
          carrierId: request.carrierId,
        },
        include: {
          lane: { select: { distance: true } },
        },
      });
    }

    if (request.laneId) {
      // Find the assigned carrier or cheapest option
      return this.prisma.laneCarrier.findFirst({
        where: {
          laneId: request.laneId,
          carrier: { archived: false },
        },
        include: {
          lane: { select: { distance: true } },
        },
        orderBy: [
          { assigned: 'desc' },
          { price: 'asc' },
        ],
      });
    }

    return null;
  }
}
