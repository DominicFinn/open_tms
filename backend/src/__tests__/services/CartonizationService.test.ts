import { CartonizationService } from '../../services/CartonizationService';

describe('CartonizationService', () => {
  const mockCartons = [
    { id: 'c1', name: 'Small Mailer', lengthMm: 250, widthMm: 200, heightMm: 100, maxWeightGrams: 2000, unitCostCents: 50, active: true, locationId: 'loc-1' },
    { id: 'c2', name: 'Medium Box', lengthMm: 400, widthMm: 300, heightMm: 200, maxWeightGrams: 10000, unitCostCents: 120, active: true, locationId: 'loc-1' },
    { id: 'c3', name: 'Large Box', lengthMm: 600, widthMm: 400, heightMm: 400, maxWeightGrams: 25000, unitCostCents: 250, active: true, locationId: 'loc-1' },
  ];

  const mockProductUom = { id: 'uom-1', sku: 'SKU-001', lengthMm: 100, widthMm: 80, heightMm: 50, weightGrams: 500, isDefault: true };

  it('recommends smallest fitting carton', async () => {
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(mockProductUom) },
      orderLineItem: { findUnique: jest.fn() },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-001', quantity: 2 },
    ]);

    // 2 items: total volume = 2 * (100*80*50) = 800,000 mm3
    // Small Mailer volume = 250*200*100 = 5,000,000 - fits (16% util)
    // Medium Box volume = 400*300*200 = 24,000,000 - fits (3.3% util)
    // Should recommend Small Mailer (highest utilization that fits)
    expect(result.recommended).not.toBeNull();
    expect(result.recommended!.cartonName).toBe('Small Mailer');
    expect(result.recommended!.fits).toBe(true);
    expect(result.recommended!.volumeUtilization).toBeLessThan(100);
    expect(result.itemsMissingDimensions).toEqual([]);
  });

  it('returns alternatives after recommended', async () => {
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(mockProductUom) },
      orderLineItem: { findUnique: jest.fn() },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-001', quantity: 1 },
    ]);

    expect(result.recommended).not.toBeNull();
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.every(a => a.fits)).toBe(true);
  });

  it('handles items too large for any carton', async () => {
    const hugeItem = { ...mockProductUom, lengthMm: 1000, widthMm: 1000, heightMm: 1000, weightGrams: 50000 };
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(hugeItem) },
      orderLineItem: { findUnique: jest.fn() },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-001', quantity: 1 },
    ]);

    // 1,000,000,000 mm3 - too big for any carton
    expect(result.recommended).toBeNull();
  });

  it('reports SKUs missing dimensions', async () => {
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(null) }, // no UOM data
      orderLineItem: { findUnique: jest.fn().mockResolvedValue(null) }, // no line item dims
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'UNKNOWN-SKU', quantity: 1 },
    ]);

    expect(result.itemsMissingDimensions).toContain('UNKNOWN-SKU');
    expect(result.recommended).toBeNull(); // Can't recommend without dims
  });

  it('falls back to OrderLineItem dimensions when ProductUom missing', async () => {
    const lineItem = { id: 'oli-1', length: 10, width: 8, height: 5, weight: 0.5, dimUnit: 'cm', weightUnit: 'kg' };
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(null) },
      orderLineItem: { findUnique: jest.fn().mockResolvedValue(lineItem) },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-002', quantity: 1, orderLineItemId: 'oli-1' },
    ]);

    // 10cm x 8cm x 5cm = 100mm x 80mm x 50mm = 400,000 mm3
    expect(result.recommended).not.toBeNull();
    expect(result.itemsMissingDimensions).toEqual([]);
    expect(result.totalItemWeightGrams).toBe(500); // 0.5kg = 500g
  });

  it('respects weight limits', async () => {
    const heavyItem = { ...mockProductUom, lengthMm: 50, widthMm: 50, heightMm: 50, weightGrams: 5000 };
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(heavyItem) },
      orderLineItem: { findUnique: jest.fn() },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue(mockCartons) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-001', quantity: 1 },
    ]);

    // Volume is tiny (125,000 mm3) but weight is 5000g
    // Small Mailer max 2000g - doesn't fit by weight
    // Medium Box max 10000g - fits
    expect(result.recommended).not.toBeNull();
    expect(result.recommended!.cartonName).toBe('Medium Box');
  });

  it('returns empty when no cartons in catalogue', async () => {
    const prisma = {
      productUom: { findFirst: jest.fn().mockResolvedValue(mockProductUom) },
      orderLineItem: { findUnique: jest.fn() },
      cartonCatalogue: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const service = new CartonizationService(prisma);
    const result = await service.recommend('loc-1', 'org-1', [
      { sku: 'SKU-001', quantity: 1 },
    ]);

    expect(result.recommended).toBeNull();
    expect(result.alternatives).toEqual([]);
  });
});
