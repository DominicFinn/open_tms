import { mapCustomsLineItem, totalDeclaredValueFor } from '../../services/customs/customsLineItemMapping';

describe('mapCustomsLineItem', () => {
  it('populates hsCode, countryOfOrigin, and declaredValue from the line item total', () => {
    const result = mapCustomsLineItem({
      quantity: 2,
      unitPriceCents: 1500,
      totalPriceCents: 3000,
      hsCode: '8501.10',
      countryOfOrigin: 'US',
    });

    expect(result.hsCode).toBe('8501.10');
    expect(result.countryOfOrigin).toBe('US');
    expect(result.declaredValue).toBe('30.00');
  });

  it('falls back to unitPriceCents * quantity when totalPriceCents is not set', () => {
    const result = mapCustomsLineItem({
      quantity: 3,
      unitPriceCents: 500,
      totalPriceCents: null,
      hsCode: null,
      countryOfOrigin: null,
    });

    expect(result.declaredValue).toBe('15.00');
    expect(result.hsCode).toBeUndefined();
    expect(result.countryOfOrigin).toBeUndefined();
  });

  it('leaves declaredValue undefined when no pricing data is set', () => {
    const result = mapCustomsLineItem({
      quantity: 1,
      unitPriceCents: null,
      totalPriceCents: null,
      hsCode: null,
      countryOfOrigin: null,
    });

    expect(result.declaredValue).toBeUndefined();
  });
});

describe('totalDeclaredValueFor', () => {
  it('sums declared value across line items', () => {
    const total = totalDeclaredValueFor([
      { quantity: 2, unitPriceCents: null, totalPriceCents: 3000 },
      { quantity: 1, unitPriceCents: 1000, totalPriceCents: null },
    ]);

    expect(total).toBe('40.00');
  });

  it('is undefined when no line item has pricing data', () => {
    const total = totalDeclaredValueFor([
      { quantity: 1, unitPriceCents: null, totalPriceCents: null },
    ]);

    expect(total).toBeUndefined();
  });
});
