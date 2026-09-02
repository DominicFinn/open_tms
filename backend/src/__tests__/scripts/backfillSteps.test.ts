import { selectSteps, type BackfillStep } from '../../scripts/backfillSteps';

const steps: BackfillStep[] = [
  { name: 'orders', label: 'orders', run: async () => 0 },
  { name: 'lanes', label: 'lanes', run: async () => 0 },
  { name: 'wmsFulfilmentOrders', label: 'warehouse fulfilment orders', run: async () => 0 },
];

describe('selectSteps', () => {
  it('runs everything when no flag is given', () => {
    expect(selectSteps([], steps).map((s) => s.name)).toEqual(['orders', 'lanes', 'wmsFulfilmentOrders']);
  });

  it('runs only the named step', () => {
    expect(selectSteps(['--only=wmsFulfilmentOrders'], steps).map((s) => s.name)).toEqual(['wmsFulfilmentOrders']);
  });

  it('accepts several names and keeps the declared order', () => {
    expect(selectSteps(['--only=lanes,orders'], steps).map((s) => s.name)).toEqual(['orders', 'lanes']);
  });

  it('tolerates spacing and trailing commas', () => {
    expect(selectSteps(['--only=orders, lanes,'], steps).map((s) => s.name)).toEqual(['orders', 'lanes']);
  });

  it('refuses an unknown name rather than silently backfilling nothing', () => {
    expect(() => selectSteps(['--only=widgets'], steps)).toThrow(/Unknown backfill step\(s\): widgets/);
  });

  it('names the available steps when it refuses', () => {
    expect(() => selectSteps(['--only=widgets'], steps)).toThrow(/orders, lanes, wmsFulfilmentOrders/);
  });

  it('ignores other arguments', () => {
    expect(selectSteps(['--verbose'], steps)).toHaveLength(3);
  });
});
