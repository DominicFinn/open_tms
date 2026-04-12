import { PrismaClient } from '@prisma/client';
import { IChargeRepository } from '../repositories/ChargeRepository.js';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface MatchLineItemInput {
  shipmentId: string;
  chargeType: string;
  invoicedAmountCents: number;
}

export interface MatchResult {
  matchStatus: 'matched' | 'variance' | 'unmatched';
  expectedAmountCents: number | null;
  varianceCents: number | null;
  variancePercent: number | null;
}

export interface ThreeWayMatchResult {
  overallStatus: 'matched' | 'partial_match' | 'mismatch';
  totalExpectedCents: number;
  totalInvoicedCents: number;
  totalVarianceCents: number;
  variancePercent: number;
  autoApproved: boolean;
  lineResults: Array<MatchLineItemInput & MatchResult>;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IFreightAuditService {
  threeWayMatch(carrierId: string, lineItems: MatchLineItemInput[]): Promise<ThreeWayMatchResult>;
  getAutoApproveTolerancePercent(orgId: string): Promise<number>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class FreightAuditService implements IFreightAuditService {
  constructor(
    private chargeRepo: IChargeRepository,
    private prisma: PrismaClient,
  ) {}

  async threeWayMatch(carrierId: string, lineItems: MatchLineItemInput[]): Promise<ThreeWayMatchResult> {
    const lineResults: Array<MatchLineItemInput & MatchResult> = [];
    let totalExpectedCents = 0;
    let totalInvoicedCents = 0;

    for (const item of lineItems) {
      // Find expected cost charges for this shipment + charge type
      const expectedCharges = await this.chargeRepo.findAll({
        shipmentId: item.shipmentId,
        chargeCategory: 'cost',
        chargeType: item.chargeType,
      });

      const expectedTotal = expectedCharges
        .filter(c => c.status !== 'written_off')
        .reduce((sum, c) => sum + c.amountCents, 0);

      let matchResult: MatchResult;

      if (expectedCharges.length === 0) {
        matchResult = {
          matchStatus: 'unmatched',
          expectedAmountCents: null,
          varianceCents: null,
          variancePercent: null,
        };
      } else {
        const variance = item.invoicedAmountCents - expectedTotal;
        const variancePercent = expectedTotal > 0
          ? Math.round((Math.abs(variance) / expectedTotal) * 10000) / 100
          : 0;

        matchResult = {
          matchStatus: variance === 0 ? 'matched' : 'variance',
          expectedAmountCents: expectedTotal,
          varianceCents: variance,
          variancePercent,
        };
      }

      totalExpectedCents += matchResult.expectedAmountCents ?? 0;
      totalInvoicedCents += item.invoicedAmountCents;

      lineResults.push({ ...item, ...matchResult });
    }

    const totalVariance = totalInvoicedCents - totalExpectedCents;
    const totalVariancePercent = totalExpectedCents > 0
      ? Math.round((Math.abs(totalVariance) / totalExpectedCents) * 10000) / 100
      : 0;

    const hasUnmatched = lineResults.some(l => l.matchStatus === 'unmatched');
    const hasVariance = lineResults.some(l => l.matchStatus === 'variance');

    let overallStatus: 'matched' | 'partial_match' | 'mismatch';
    if (!hasUnmatched && !hasVariance) {
      overallStatus = 'matched';
    } else if (hasUnmatched) {
      overallStatus = 'mismatch';
    } else {
      overallStatus = 'partial_match';
    }

    // Check auto-approve tolerance
    // Default 2% if no org setting
    const tolerancePercent = 2.0;
    const autoApproved = overallStatus !== 'mismatch' && totalVariancePercent <= tolerancePercent;

    return {
      overallStatus,
      totalExpectedCents,
      totalInvoicedCents,
      totalVarianceCents: totalVariance,
      variancePercent: totalVariancePercent,
      autoApproved,
      lineResults,
    };
  }

  async getAutoApproveTolerancePercent(_orgId: string): Promise<number> {
    // In future, read from Organization settings
    return 2.0;
  }
}
