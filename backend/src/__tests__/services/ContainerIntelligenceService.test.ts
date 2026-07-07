import { ContainerIntelligenceService, PackItem } from '../../services/containers/ContainerIntelligenceService';

function mkCarton(overrides: Partial<any> = {}): any {
  return {
    id: overrides.id ?? 'c-std',
    locationId: 'loc-1',
    name: overrides.name ?? 'Medium Box',
    lengthMm: 400, widthMm: 300, heightMm: 200,
    maxWeightGrams: 30_000,
    unitCostCents: 150,
    active: true,
    temperatureZone: 'any',
    insulated: false,
    insulationHours: null,
    tamperEvident: false,
    valueClass: 'any',
    hazmatRated: false,
    hazmatClasses: [],
    materialType: 'corrugated',
    orgId: 'org-1',
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function mkItem(overrides: Partial<PackItem> = {}): PackItem {
  return {
    sku: overrides.sku ?? 'SKU-A',
    quantity: 1,
    lengthMm: 100, widthMm: 80, heightMm: 60,
    weightGrams: 500,
    temperatureZone: 'ambient',
    ...overrides,
  };
}

const svc = new ContainerIntelligenceService();

describe('ContainerIntelligenceService - input validation', () => {
  it('errors when items list is empty', () => {
    const r = svc.recommend([], [mkCarton()]);
    expect(r.errors).toContain('No items to pack');
    expect(r.packages).toHaveLength(0);
  });

  it('errors when catalogue has no active cartons', () => {
    const r = svc.recommend([mkItem()], []);
    expect(r.errors).toContain('No active cartons in the catalogue');
  });

  it('errors when an item has zero dimensions or weight', () => {
    const r = svc.recommend([mkItem({ lengthMm: 0 })], [mkCarton()]);
    expect(r.errors.some(e => e.includes('missing or non-positive'))).toBe(true);
  });

  it('errors when a hazmat item has no hazmat class', () => {
    const r = svc.recommend([mkItem({ hazmat: true })], [mkCarton()]);
    expect(r.errors.some(e => e.includes('no hazmatClass'))).toBe(true);
  });

  it('skips inactive cartons entirely', () => {
    const r = svc.recommend([mkItem()], [mkCarton({ active: false })]);
    expect(r.errors).toContain('No active cartons in the catalogue');
  });
});

describe('ContainerIntelligenceService - best-fit for ambient cargo', () => {
  it('picks the smallest qualifying carton by volume', () => {
    const small = mkCarton({ id: 'small', name: 'Small', lengthMm: 200, widthMm: 150, heightMm: 100, maxWeightGrams: 5_000, unitCostCents: 50 });
    const medium = mkCarton({ id: 'med', name: 'Medium' });
    const large = mkCarton({ id: 'large', name: 'Large', lengthMm: 600, widthMm: 400, heightMm: 300, maxWeightGrams: 50_000, unitCostCents: 350 });
    const r = svc.recommend([mkItem({ lengthMm: 150, widthMm: 100, heightMm: 80, weightGrams: 2_000 })], [small, medium, large]);
    expect(r.errors).toHaveLength(0);
    expect(r.packages).toHaveLength(1);
    expect(r.packages[0].cartonId).toBe('small');
    expect(r.totalContainerCostCents).toBe(50);
  });

  it('rejects cartons whose longest edge is shorter than the longest item dim', () => {
    const narrowButTall = mkCarton({ id: 'narrow', lengthMm: 200, widthMm: 200, heightMm: 200 });
    const longEnough = mkCarton({ id: 'long', lengthMm: 800, widthMm: 200, heightMm: 200 });
    const longItem = mkItem({ lengthMm: 700, widthMm: 50, heightMm: 50, weightGrams: 500 });
    const r = svc.recommend([longItem], [narrowButTall, longEnough]);
    expect(r.packages[0].cartonId).toBe('long');
  });

  it('errors cleanly when nothing fits', () => {
    const tiny = mkCarton({ id: 'tiny', lengthMm: 50, widthMm: 50, heightMm: 50, maxWeightGrams: 100 });
    const r = svc.recommend([mkItem()], [tiny]);
    expect(r.packages).toHaveLength(0);
    expect(r.errors[0]).toMatch(/No carton qualifies/);
  });

  it('bumps up when total weight exceeds the smallest fit', () => {
    const light = mkCarton({ id: 'light', maxWeightGrams: 1_000 });
    const heavy = mkCarton({ id: 'heavy', maxWeightGrams: 50_000 });
    const r = svc.recommend([mkItem({ quantity: 10, weightGrams: 500 })], [light, heavy]);
    expect(r.packages[0].cartonId).toBe('heavy');
  });

  it('sums volume across multiple SKUs when packing the same group', () => {
    const small = mkCarton({ id: 'small', lengthMm: 200, widthMm: 100, heightMm: 100 }); // 2,000,000 mm3
    const medium = mkCarton({ id: 'medium' }); // 400×300×200 = 24,000,000 mm3
    // Two items each 150×80×60 = 720,000 mm3, ×1 each = 1,440,000 < small
    // But let's add a third item that pushes past small
    const items = [
      mkItem({ sku: 'A', lengthMm: 150, widthMm: 80, heightMm: 60 }),
      mkItem({ sku: 'B', lengthMm: 150, widthMm: 80, heightMm: 60 }),
      mkItem({ sku: 'C', lengthMm: 150, widthMm: 80, heightMm: 60 }),
    ];
    // Total volume 3 × 720,000 = 2,160,000 > small (2,000,000) → medium
    const r = svc.recommend(items, [small, medium]);
    expect(r.packages[0].cartonId).toBe('medium');
    expect(r.packages[0].items).toHaveLength(3);
  });
});

describe('ContainerIntelligenceService - temperature zone grouping', () => {
  const ambientBox = mkCarton({ id: 'amb', name: 'Ambient', temperatureZone: 'any' });
  const chilledBox = mkCarton({ id: 'chilled', name: 'Insulated Cool Box', temperatureZone: 'refrigerated', insulated: true, insulationHours: 24, unitCostCents: 800 });
  const frozenBox = mkCarton({ id: 'frozen', name: 'Frozen Shipper', temperatureZone: 'frozen', insulated: true, insulationHours: 72, unitCostCents: 1500 });

  it('routes ambient items to any-temperature cartons', () => {
    const r = svc.recommend([mkItem({ temperatureZone: 'ambient' })], [ambientBox, chilledBox, frozenBox]);
    expect(r.packages[0].cartonId).toBe('amb');
  });

  it('routes refrigerated items to refrigerated cartons and adds a gel_pack ancillary', () => {
    const r = svc.recommend([mkItem({ temperatureZone: 'refrigerated' })], [ambientBox, chilledBox, frozenBox]);
    expect(r.packages[0].cartonId).toBe('chilled');
    expect(r.packages[0].ancillaries).toContain('gel_pack');
  });

  it('routes frozen items to frozen cartons with dry_ice', () => {
    const r = svc.recommend([mkItem({ temperatureZone: 'frozen' })], [ambientBox, chilledBox, frozenBox]);
    expect(r.packages[0].cartonId).toBe('frozen');
    expect(r.packages[0].ancillaries).toContain('dry_ice');
  });

  it('splits ambient + frozen items into two separate packages', () => {
    const r = svc.recommend(
      [
        mkItem({ sku: 'AMB', temperatureZone: 'ambient' }),
        mkItem({ sku: 'FRZ', temperatureZone: 'frozen' }),
      ],
      [ambientBox, chilledBox, frozenBox],
    );
    expect(r.packages).toHaveLength(2);
    expect(r.packages.map(p => p.cartonId).sort()).toEqual(['amb', 'frozen']);
  });

  it('splits ambient + chilled + frozen into three packages', () => {
    const r = svc.recommend(
      [
        mkItem({ sku: 'AMB', temperatureZone: 'ambient' }),
        mkItem({ sku: 'REF', temperatureZone: 'refrigerated' }),
        mkItem({ sku: 'FRZ', temperatureZone: 'frozen' }),
      ],
      [ambientBox, chilledBox, frozenBox],
    );
    expect(r.packages).toHaveLength(3);
  });

  it('errors when there is no carton for a required temperature zone', () => {
    const r = svc.recommend([mkItem({ temperatureZone: 'frozen' })], [ambientBox]);
    expect(r.errors[0]).toMatch(/temperature=frozen/);
  });

  it('promotes refrigerated to dry_ice when transit exceeds 24h', () => {
    const r = svc.recommend(
      [mkItem({ temperatureZone: 'refrigerated' })],
      [chilledBox],
      { transitHours: 36 },
    );
    expect(r.packages[0].ancillaries).toContain('dry_ice');
    expect(r.warnings.some(w => w.includes('36h transit'))).toBe(true);
  });

  it('does not add dry_ice for refrigerated when transit is short', () => {
    const r = svc.recommend(
      [mkItem({ temperatureZone: 'refrigerated' })],
      [chilledBox],
      { transitHours: 12 },
    );
    expect(r.packages[0].ancillaries).not.toContain('dry_ice');
  });
});

describe('ContainerIntelligenceService - hazmat segregation', () => {
  const generalBox = mkCarton({ id: 'gen', name: 'General' });
  const hazmatClass3Box = mkCarton({ id: 'haz3', name: 'Class 3 Hazmat', hazmatRated: true, hazmatClasses: ['3'] });
  const hazmatClass5Box = mkCarton({ id: 'haz5', name: 'Class 5.1 Hazmat', hazmatRated: true, hazmatClasses: ['5.1'] });
  const hazmatClass3and5Box = mkCarton({ id: 'haz_mix', name: 'Multi-class Hazmat', hazmatRated: true, hazmatClasses: ['3', '5.1'] });

  it('always separates hazmat from non-hazmat', () => {
    const r = svc.recommend(
      [
        mkItem({ sku: 'SAFE' }),
        mkItem({ sku: 'FLAM', hazmat: true, hazmatClass: '3' }),
      ],
      [generalBox, hazmatClass3Box],
    );
    expect(r.packages).toHaveLength(2);
    const safe = r.packages.find(p => p.cartonId === 'gen')!;
    const hazmat = r.packages.find(p => p.cartonId === 'haz3')!;
    expect(safe.items[0].sku).toBe('SAFE');
    expect(hazmat.items[0].sku).toBe('FLAM');
    expect(hazmat.specialHandling).toContain('hazmat');
  });

  it('does not pack hazmat cargo into a non-hazmat-rated carton', () => {
    const r = svc.recommend(
      [mkItem({ hazmat: true, hazmatClass: '3' })],
      [generalBox],
    );
    expect(r.errors[0]).toMatch(/No carton qualifies/);
    expect(r.errors[0]).toMatch(/hazmat=3/);
  });

  it('does not put non-hazmat cargo into a dedicated-hazmat carton', () => {
    const r = svc.recommend(
      [mkItem()],
      [hazmatClass3Box],
    );
    expect(r.errors[0]).toMatch(/No carton qualifies/);
  });

  it('splits incompatible hazmat classes (class 3 flammable + class 5.1 oxidizer)', () => {
    const r = svc.recommend(
      [
        mkItem({ sku: 'FLAM', hazmat: true, hazmatClass: '3' }),
        mkItem({ sku: 'OXID', hazmat: true, hazmatClass: '5.1' }),
      ],
      [hazmatClass3Box, hazmatClass5Box, hazmatClass3and5Box],
    );
    expect(r.packages).toHaveLength(2);
    expect(r.packages.map(p => p.hazmatClasses.sort().join(','))).toEqual(expect.arrayContaining(['3', '5.1']));
  });

  it('allows compatible hazmat classes in a single multi-class carton', () => {
    // Class 3 and class 8 are segregation-incompatible per HAZMAT_SEGREGATION['3']
    // so test with compatible pair: class 3 and class 6.1 are NOT in each others' conflict list.
    const compatibleBox = mkCarton({ id: 'compat', name: 'Compat', hazmatRated: true, hazmatClasses: ['3', '6.1'] });
    const r = svc.recommend(
      [
        mkItem({ sku: 'FLAM', hazmat: true, hazmatClass: '3' }),
        mkItem({ sku: 'TOX', hazmat: true, hazmatClass: '6.1' }),
      ],
      [compatibleBox],
    );
    expect(r.packages).toHaveLength(1);
    expect(r.packages[0].hazmatClasses.sort()).toEqual(['3', '6.1']);
  });

  it('errors when no hazmat-rated carton covers the required class', () => {
    const r = svc.recommend(
      [mkItem({ hazmat: true, hazmatClass: '8' })],
      [hazmatClass3Box],
    );
    expect(r.errors[0]).toMatch(/No carton qualifies/);
  });
});

describe('ContainerIntelligenceService - value + fragile handling', () => {
  const standardBox = mkCarton({ id: 'std' });
  const highValueBox = mkCarton({ id: 'hv', name: 'Tamper-evident HV Box', valueClass: 'high_value', tamperEvident: true, unitCostCents: 500 });

  it('routes high-value cargo only to high-value cartons', () => {
    const r = svc.recommend(
      [mkItem({ valueClass: 'high_value' })],
      [standardBox, highValueBox],
    );
    expect(r.packages[0].cartonId).toBe('hv');
    expect(r.packages[0].specialHandling).toContain('high_value');
  });

  it('does not use a standard carton for high-value cargo', () => {
    const r = svc.recommend([mkItem({ valueClass: 'high_value' })], [standardBox]);
    expect(r.errors[0]).toMatch(/value=high_value/);
  });

  it('adds tamper_seal ancillary when high-value carton is not tamper-evident', () => {
    const hvNoSeal = mkCarton({ id: 'hvns', valueClass: 'high_value', tamperEvident: false });
    const r = svc.recommend([mkItem({ valueClass: 'high_value' })], [hvNoSeal]);
    expect(r.packages[0].ancillaries).toContain('tamper_seal');
  });

  it('does not add tamper_seal when the carton is already tamper-evident', () => {
    const r = svc.recommend([mkItem({ valueClass: 'high_value' })], [highValueBox]);
    expect(r.packages[0].ancillaries).not.toContain('tamper_seal');
  });

  it('adds fragile_padding when any item is fragile', () => {
    const r = svc.recommend([mkItem({ fragile: true })], [standardBox]);
    expect(r.packages[0].ancillaries).toContain('fragile_padding');
    expect(r.packages[0].specialHandling).toContain('fragile');
  });

  it('combines multiple ancillaries for a complex package', () => {
    const hvFragileBox = mkCarton({ id: 'hvf', valueClass: 'high_value', tamperEvident: false });
    const r = svc.recommend(
      [mkItem({ valueClass: 'high_value', fragile: true })],
      [hvFragileBox],
    );
    const anc = r.packages[0].ancillaries;
    expect(anc).toEqual(expect.arrayContaining(['fragile_padding', 'tamper_seal']));
  });
});

describe('ContainerIntelligenceService - grouping and clustering', () => {
  it('clusters ambient standard-value non-hazmat items into one package', () => {
    const box = mkCarton({ id: 'b' });
    const r = svc.recommend(
      [
        mkItem({ sku: 'A' }),
        mkItem({ sku: 'B' }),
        mkItem({ sku: 'C' }),
      ],
      [box],
    );
    expect(r.packages).toHaveLength(1);
    expect(r.packages[0].items).toHaveLength(3);
  });

  it('separates standard and high-value items even at the same temperature', () => {
    const std = mkCarton({ id: 'std' });
    const hv = mkCarton({ id: 'hv', valueClass: 'high_value', tamperEvident: true });
    const r = svc.recommend(
      [
        mkItem({ sku: 'STD' }),
        mkItem({ sku: 'HV', valueClass: 'high_value' }),
      ],
      [std, hv],
    );
    expect(r.packages).toHaveLength(2);
  });

  it('splits mixed temperature + hazmat combinations correctly', () => {
    const amb = mkCarton({ id: 'amb' });
    const chilled = mkCarton({ id: 'ch', temperatureZone: 'refrigerated', insulated: true });
    const hazmat3 = mkCarton({ id: 'h3', hazmatRated: true, hazmatClasses: ['3'] });

    const r = svc.recommend(
      [
        mkItem({ sku: 'DRY' }),
        mkItem({ sku: 'COOL', temperatureZone: 'refrigerated' }),
        mkItem({ sku: 'FLAM', hazmat: true, hazmatClass: '3' }),
      ],
      [amb, chilled, hazmat3],
    );
    expect(r.packages).toHaveLength(3);
  });

  it('produces reasons that describe why each package split happened', () => {
    const amb = mkCarton({ id: 'amb' });
    const chilled = mkCarton({ id: 'ch', temperatureZone: 'refrigerated' });
    const hv = mkCarton({ id: 'hv', valueClass: 'high_value' });
    const hazmat = mkCarton({ id: 'hz', hazmatRated: true, hazmatClasses: ['8'] });

    const r = svc.recommend(
      [
        mkItem({ sku: 'PLAIN' }),
        mkItem({ sku: 'COOL', temperatureZone: 'refrigerated' }),
        mkItem({ sku: 'WATCH', valueClass: 'high_value' }),
        mkItem({ sku: 'ACID', hazmat: true, hazmatClass: '8' }),
      ],
      [amb, chilled, hv, hazmat],
    );
    expect(r.packages.find(p => p.cartonId === 'amb')?.reason).toMatch(/best-fit/);
    expect(r.packages.find(p => p.cartonId === 'ch')?.reason).toMatch(/refrigerated/);
    expect(r.packages.find(p => p.cartonId === 'hv')?.reason).toMatch(/high-value/);
    expect(r.packages.find(p => p.cartonId === 'hz')?.reason).toMatch(/hazmat class 8/);
  });

  it('computes volume and weight utilization percentages', () => {
    const box = mkCarton({ id: 'b', lengthMm: 200, widthMm: 200, heightMm: 200, maxWeightGrams: 10_000 });
    // 1 item 100×100×100 → 1M mm3 out of 8M → 12.5%; 5kg out of 10kg → 50%
    const r = svc.recommend([mkItem({ lengthMm: 100, widthMm: 100, heightMm: 100, weightGrams: 5_000 })], [box]);
    expect(r.packages[0].volumeUtilizationPercent).toBeCloseTo(12.5, 1);
    expect(r.packages[0].weightUtilizationPercent).toBeCloseTo(50, 1);
  });

  it('totals container cost and package weight across all packages', () => {
    const box1 = mkCarton({ id: 'b1', unitCostCents: 100 });
    const box2 = mkCarton({ id: 'b2', temperatureZone: 'refrigerated', unitCostCents: 800 });
    const r = svc.recommend(
      [
        mkItem({ sku: 'A', weightGrams: 1_000 }),
        mkItem({ sku: 'B', temperatureZone: 'refrigerated', weightGrams: 2_000 }),
      ],
      [box1, box2],
    );
    expect(r.totalContainerCostCents).toBe(900);
    expect(r.totalWeightGrams).toBe(3_000);
  });
});
