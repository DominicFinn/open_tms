import { RecordPackAuditCommandHandler, RECORD_PACK_AUDIT } from '../../commands/packAudit/RecordPackAuditCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeTx(overrides: Partial<any> = {}) {
  return {
    packTask: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'pack-1',
        orderId: 'order-1',
        packLines: [
          { sku: 'SKU-A', expectedQuantity: 2 },
          { sku: 'SKU-B', expectedQuantity: 1 },
        ],
      }),
    },
    productUom: {
      findMany: jest.fn().mockResolvedValue([
        { sku: 'SKU-A', weightGrams: 500 },
        { sku: 'SKU-B', weightGrams: 200 },
      ]),
    },
    cartonCatalogue: { findUnique: jest.fn() },
    issue: { create: jest.fn().mockResolvedValue({ id: 'issue-1' }) },
    packAudit: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'audit-1', ...data })),
    },
    ...overrides,
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('RecordPackAuditCommand', () => {
  it('computes expected weight from SKU catalog and verdicts pass when within tolerance', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected = 2×500 + 1×200 = 1200g. Actual 1240g = +3.3% → within 10% → pass
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 1240 }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.verdict).toBe('pass');
    expect(result.data?.expectedWeightGrams).toBe(1200);
    expect(result.data?.weightVariancePercent).toBeCloseTo(3.33, 1);
    expect(result.data?.issueId).toBeNull();
    expect(tx.issue.create).not.toHaveBeenCalled();
    expect(result.events[0].type).toBe(EVENT_TYPES.PACK_AUDIT_RECORDED);
  });

  it('returns verdict "warning" and creates an issue when variance exceeds tolerance but within 2x', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected = 1200g, actual 1400g = +16.7% → 10 < 16.7 < 20 → warning
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 1400 }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.verdict).toBe('warning');
    expect(result.data?.issueId).toBe('issue-1');
    expect(tx.issue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        priority: 'medium',
        category: 'quality',
        sourceEntityType: 'pack_task',
        sourceEntityId: 'pack-1',
      }),
    }));
    const varianceEvent = result.events.find(e => e.type === EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED);
    expect(varianceEvent).toBeDefined();
  });

  it('returns verdict "fail" and creates a high-priority issue beyond 2x tolerance', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected 1200g, actual 1800g = +50% → fail
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 1800 }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.verdict).toBe('fail');
    expect(tx.issue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ priority: 'high' }),
    }));
  });

  it('handles negative variance (lighter than expected) symmetrically', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected 1200g, actual 600g = -50% → fail
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 600 }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.verdict).toBe('fail');
    expect(result.data?.weightVariancePercent).toBe(-50);
  });

  it('respects a custom tolerance percent', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected 1200g, actual 1260g = +5%, tolerance 2% → warning (within 2× = 4%? No, 5% > 2*2=4 → fail)
    // Let's be careful: abs=5, tolerance=2, 2x=4, so 5 > 4 → fail
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 1260, weightTolerancePercent: 2 }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.verdict).toBe('fail');
  });

  it('uses expectedWeightGramsOverride when provided', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Override expected to 2000g, actual 2050g = +2.5% → pass
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, {
        packTaskId: 'pack-1', actualWeightGrams: 2050, expectedWeightGramsOverride: 2000,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.expectedWeightGrams).toBe(2000);
    expect(result.data?.verdict).toBe('pass');
    expect(tx.productUom.findMany).not.toHaveBeenCalled();
  });

  it('computes dim-weight variance when actual and expected dimensions are provided', async () => {
    const tx = makeTx({
      cartonCatalogue: {
        findUnique: jest.fn().mockResolvedValue({ lengthMm: 400, widthMm: 300, heightMm: 200 }),
      },
    });
    const { bus } = mockEventBus();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), bus);

    // Expected carton 40×30×20 cm = 24000 cc / 5000 = 4.8 kg dim-weight
    // Actual 50×30×20 cm = 30000 cc / 5000 = 6.0 kg → +25%
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, {
        packTaskId: 'pack-1',
        actualWeightGrams: 1200,
        cartonCatalogueId: 'carton-1',
        actualLengthMm: 500, actualWidthMm: 300, actualHeightMm: 200,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.dimWeightVariancePercent).toBeCloseTo(25, 1);
  });

  it('rejects negative or missing actual weight', async () => {
    const tx = makeTx();
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), mockEventBus().bus);
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 0 }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/actualWeightGrams/);
  });

  it('throws when no SKU weights are configured', async () => {
    const tx = makeTx({ productUom: { findMany: jest.fn().mockResolvedValue([]) } });
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), mockEventBus().bus);
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'pack-1', actualWeightGrams: 1000 }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no SKU weights/);
  });

  it('returns 404-equivalent error when pack task does not exist', async () => {
    const tx = makeTx({ packTask: { findUnique: jest.fn().mockResolvedValue(null) } });
    const handler = new RecordPackAuditCommandHandler(makePrisma(tx), mockEventBus().bus);
    const result = await handler.execute(
      createTestCommand(RECORD_PACK_AUDIT, { packTaskId: 'missing', actualWeightGrams: 1000 }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/);
  });
});
