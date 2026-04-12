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
      expect(result.totalExpectedCents).toBe(150000);
      expect(result.totalInvoicedCents).toBe(150000);
      expect(result.totalVarianceCents).toBe(0);
      expect(result.variancePercent).toBe(0);
      expect(result.autoApproved).toBe(true);
      expect(result.lineResults).toHaveLength(1);
      expect(result.lineResults[0].matchStatus).toBe('matched');
      expect(result.lineResults[0].expectedAmountCents).toBe(150000);
      expect(result.lineResults[0].varianceCents).toBe(0);
    });

    it('returns variance when amounts differ', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 150000, status: 'approved', chargeCategory: 'cost', chargeType: 'linehaul' },
      ]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 160000 },
      ]);

      expect(result.overallStatus).toBe('partial_match');
      expect(result.totalVarianceCents).toBe(10000);
      expect(result.lineResults[0].matchStatus).toBe('variance');
      expect(result.lineResults[0].varianceCents).toBe(10000);
      expect(result.lineResults[0].variancePercent).toBeCloseTo(6.67, 1);
    });

    it('returns unmatched when no expected charges', async () => {
      mockChargeRepo.findAll.mockResolvedValue([]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
      ]);

      expect(result.overallStatus).toBe('mismatch');
      expect(result.autoApproved).toBe(false);
      expect(result.lineResults[0].matchStatus).toBe('unmatched');
      expect(result.lineResults[0].expectedAmountCents).toBeNull();
      expect(result.lineResults[0].varianceCents).toBeNull();
      expect(result.lineResults[0].variancePercent).toBeNull();
    });

    it('auto-approves within tolerance', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 150000, status: 'approved', chargeCategory: 'cost', chargeType: 'linehaul' },
      ]);

      // 1% variance ($1,500 on $150,000) — within the default 2% tolerance
      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 151500 },
      ]);

      expect(result.overallStatus).toBe('partial_match');
      expect(result.autoApproved).toBe(true);
      expect(result.variancePercent).toBe(1);
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

    it('does not auto-approve unmatched line items regardless of tolerance', async () => {
      mockChargeRepo.findAll.mockResolvedValue([]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 100 },
      ]);

      expect(result.overallStatus).toBe('mismatch');
      expect(result.autoApproved).toBe(false);
    });

    it('handles multiple line items across charge types', async () => {
      mockChargeRepo.findAll
        .mockResolvedValueOnce([{ amountCents: 150000, status: 'approved' }]) // linehaul
        .mockResolvedValueOnce([{ amountCents: 27000, status: 'approved' }]); // fuel_surcharge

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
        { shipmentId: 'ship-1', chargeType: 'fuel_surcharge', invoicedAmountCents: 27000 },
      ]);

      expect(result.overallStatus).toBe('matched');
      expect(result.totalExpectedCents).toBe(177000);
      expect(result.totalInvoicedCents).toBe(177000);
      expect(result.totalVarianceCents).toBe(0);
      expect(result.autoApproved).toBe(true);
      expect(result.lineResults).toHaveLength(2);
      expect(result.lineResults[0].matchStatus).toBe('matched');
      expect(result.lineResults[1].matchStatus).toBe('matched');
    });

    it('excludes written_off charges from expected total', async () => {
      mockChargeRepo.findAll.mockResolvedValue([
        { amountCents: 150000, status: 'approved', chargeCategory: 'cost' },
        { amountCents: 30000, status: 'written_off', chargeCategory: 'cost' },
      ]);

      const result = await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 150000 },
      ]);

      expect(result.overallStatus).toBe('matched');
      expect(result.totalExpectedCents).toBe(150000);
      expect(result.lineResults[0].expectedAmountCents).toBe(150000);
    });

    it('queries charge repo with correct filters for each line item', async () => {
      mockChargeRepo.findAll
        .mockResolvedValueOnce([{ amountCents: 100000, status: 'approved' }])
        .mockResolvedValueOnce([{ amountCents: 15000, status: 'approved' }]);

      await service.threeWayMatch('carrier-1', [
        { shipmentId: 'ship-1', chargeType: 'linehaul', invoicedAmountCents: 100000 },
        { shipmentId: 'ship-2', chargeType: 'fuel_surcharge', invoicedAmountCents: 15000 },
      ]);

      expect(mockChargeRepo.findAll).toHaveBeenCalledTimes(2);
      expect(mockChargeRepo.findAll).toHaveBeenNthCalledWith(1, {
        shipmentId: 'ship-1',
        chargeCategory: 'cost',
        chargeType: 'linehaul',
      });
      expect(mockChargeRepo.findAll).toHaveBeenNthCalledWith(2, {
        shipmentId: 'ship-2',
        chargeCategory: 'cost',
        chargeType: 'fuel_surcharge',
      });
    });
  });

  describe('getAutoApproveTolerancePercent', () => {
    it('returns default 2% tolerance', async () => {
      const tolerance = await service.getAutoApproveTolerancePercent('test-org');
      expect(tolerance).toBe(2.0);
    });
  });
});
