import { FreightAuditService } from '../../services/FreightAuditService';

const mockChargeRepo = {
  findAll: jest.fn(),
} as any;

const mockPrisma = {} as any;

describe('FreightAuditService', () => {
  let service: FreightAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FreightAuditService(mockChargeRepo, mockPrisma);
  });

  describe('threeWayMatch', () => {
    it('returns matched when invoiced equals expected', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 150000, status: 'approved', chargeCategory: 'cost', chargeType: 'linehaul' },
      ]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
      ]);

      expect(result.overallStatus).toBe('matched');
      expect(result.totalVarianceCents).toBe(0);
      expect(result.autoApproved).toBe(true);
      expect(result.lineResults[0].matchStatus).toBe('matched');
    });

    it('returns variance when amounts differ within tolerance', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 150000, status: 'approved', chargeCategory: 'cost', chargeType: 'linehaul' },
      ]);

      // 1% variance — within 2% tolerance
      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 151500 },
      ]);

      expect(result.overallStatus).toBe('partial_match');
      expect(result.autoApproved).toBe(true); // Within 2%
      expect(result.lineResults[0].matchStatus).toBe('variance');
      expect(result.lineResults[0].varianceCents).toBe(1500);
    });

    it('does not auto-approve when variance exceeds tolerance', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 100000, status: 'approved', chargeCategory: 'cost', chargeType: 'linehaul' },
      ]);

      // 20% variance — way over 2% tolerance
      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 120000 },
      ]);

      expect(result.overallStatus).toBe('partial_match');
      expect(result.autoApproved).toBe(false);
      expect(result.variancePercent).toBe(20);
    });

    it('returns unmatched when no expected charges exist', async () => {
      mockChargeRepo.findAll.mockResolvedValue([]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
      ]);

      expect(result.overallStatus).toBe('mismatch');
      expect(result.autoApproved).toBe(false);
      expect(result.lineResults[0].matchStatus).toBe('unmatched');
      expect(result.lineResults[0].expectedAmountCents).toBeNull();
    });

    it('handles multiple line items', async () => {
      // First call: linehaul matches
      mockChargeRepo.findAll
        .mockResolvedValueOnce([{ amountCents: 150000, status: 'approved' }])
        .mockResolvedValueOnce([{ amountCents: 27000, status: 'approved' }]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
        { shipmentId: 'ship-1', chargeType: 'fuel_surcharge', invoicedAmountCents: 27000 },
      ]);

      expect(result.overallStatus).toBe('matched');
      expect(result.totalExpectedCents).toBe(177000);
      expect(result.totalInvoicedCents).toBe(177000);
      expect(result.lineResults).toHaveLength(2);
    });
  });
});
