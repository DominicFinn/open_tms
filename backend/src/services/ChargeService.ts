import { PrismaClient, Charge } from '@prisma/client';
import { IChargeRepository, CreateChargeDTO, ChargeFilters } from '../repositories/ChargeRepository.js';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface AddChargeInput {
  orgId: string;
  shipmentId?: string;
  orderId?: string;
  chargeType: string;
  chargeCategory: 'revenue' | 'cost';
  description: string;
  amountCents: number;
  currency?: string;
  source?: string;
  sourceId?: string;
  accessorialCode?: string;
  freightClass?: string;
  nmfcCode?: string;
  ratedWeight?: number;
  ratePerCwt?: number;
  createdBy?: string;
}

export interface ShipmentFinancialSnapshot {
  shipmentId: string;
  expectedRevenueCents: number;
  expectedCostCents: number;
  expectedMarginCents: number;
  actualRevenueCents: number;
  actualCostCents: number;
  actualMarginCents: number;
  currency: string;
  charges: Charge[];
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IChargeService {
  addCharge(input: AddChargeInput): Promise<Charge>;
  approveCharge(chargeId: string, orgId: string, approvedBy: string): Promise<Charge>;
  getShipmentFinancials(shipmentId: string, orgId: string): Promise<ShipmentFinancialSnapshot | null>;
  getCharges(filters: ChargeFilters): Promise<Charge[]>;
  recalculateShipmentSummary(shipmentId: string, orgId: string): Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class ChargeService implements IChargeService {
  constructor(
    private chargeRepo: IChargeRepository,
    private prisma: PrismaClient,
  ) {}

  async addCharge(input: AddChargeInput): Promise<Charge> {
    // Validate that at least one of shipmentId or orderId is provided
    if (!input.shipmentId && !input.orderId) {
      throw new Error('A charge must be linked to a shipment or order');
    }

    // Enforce same-currency constraint on shipment charges
    if (input.shipmentId) {
      const existing = await this.chargeRepo.findByShipmentId(input.shipmentId, input.orgId);
      if (existing.length > 0) {
        const existingCurrency = existing[0].currency;
        if ((input.currency ?? 'USD') !== existingCurrency) {
          throw new Error(`All charges on a shipment must use the same currency (existing: ${existingCurrency})`);
        }
      }
    }

    const charge = await this.chargeRepo.create(input as CreateChargeDTO);

    // Recalculate shipment financial summary if charge is on a shipment
    if (input.shipmentId) {
      await this.recalculateShipmentSummary(input.shipmentId, input.orgId);
    }

    return charge;
  }

  async approveCharge(chargeId: string, orgId: string, approvedBy: string): Promise<Charge> {
    const charge = await this.chargeRepo.findById(chargeId, orgId);
    if (!charge) throw new Error('Charge not found');
    if (charge.status !== 'pending') {
      throw new Error(`Cannot approve charge in status "${charge.status}"`);
    }

    const updated = await this.chargeRepo.update(chargeId, orgId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    });

    if (charge.shipmentId) {
      await this.recalculateShipmentSummary(charge.shipmentId, orgId);
    }

    return updated;
  }

  /** Returns null when the shipment doesn't exist in the caller's org. */
  async getShipmentFinancials(shipmentId: string, orgId: string): Promise<ShipmentFinancialSnapshot | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: { id: true },
    });
    if (!shipment) return null;

    const charges = await this.chargeRepo.findByShipmentId(shipmentId, orgId);

    const revenueCents = charges
      .filter(c => c.chargeCategory === 'revenue' && c.status !== 'written_off')
      .reduce((sum, c) => sum + c.amountCents, 0);

    const costCents = charges
      .filter(c => c.chargeCategory === 'cost' && c.status !== 'written_off')
      .reduce((sum, c) => sum + c.amountCents, 0);

    // Expected = pending + approved charges, Actual = approved + invoiced
    const expectedRevenue = charges
      .filter(c => c.chargeCategory === 'revenue' && ['pending', 'approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const expectedCost = charges
      .filter(c => c.chargeCategory === 'cost' && ['pending', 'approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const actualRevenue = charges
      .filter(c => c.chargeCategory === 'revenue' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const actualCost = charges
      .filter(c => c.chargeCategory === 'cost' && ['approved', 'invoiced'].includes(c.status))
      .reduce((sum, c) => sum + c.amountCents, 0);

    const currency = charges.length > 0 ? charges[0].currency : 'USD';

    return {
      shipmentId,
      expectedRevenueCents: expectedRevenue,
      expectedCostCents: expectedCost,
      expectedMarginCents: expectedRevenue - expectedCost,
      actualRevenueCents: actualRevenue,
      actualCostCents: actualCost,
      actualMarginCents: actualRevenue - actualCost,
      currency,
      charges,
    };
  }

  async getCharges(filters: ChargeFilters): Promise<Charge[]> {
    return this.chargeRepo.findAll(filters);
  }

  async recalculateShipmentSummary(shipmentId: string, orgId: string): Promise<void> {
    const snapshot = await this.getShipmentFinancials(shipmentId, orgId);
    if (!snapshot) return;

    await this.prisma.shipmentFinancialSummary.upsert({
      where: { shipmentId },
      create: {
        shipmentId,
        orgId,
        expectedRevenueCents: snapshot.expectedRevenueCents,
        expectedCostCents: snapshot.expectedCostCents,
        expectedMarginCents: snapshot.expectedMarginCents,
        actualRevenueCents: snapshot.actualRevenueCents,
        actualCostCents: snapshot.actualCostCents,
        actualMarginCents: snapshot.actualMarginCents,
        currency: snapshot.currency,
      },
      update: {
        expectedRevenueCents: snapshot.expectedRevenueCents,
        expectedCostCents: snapshot.expectedCostCents,
        expectedMarginCents: snapshot.expectedMarginCents,
        actualRevenueCents: snapshot.actualRevenueCents,
        actualCostCents: snapshot.actualCostCents,
        actualMarginCents: snapshot.actualMarginCents,
        currency: snapshot.currency,
      },
    });
  }
}
