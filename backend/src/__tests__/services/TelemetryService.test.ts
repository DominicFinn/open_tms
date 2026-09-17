import { TelemetryService, summariseReadings } from '../../services/iot/TelemetryService';

const reading = (over: Partial<Parameters<typeof summariseReadings>[0][number]>) => ({
  temperature: null,
  batteryLevel: null,
  atmosphericPressure: null,
  isAlert: false,
  deviceId: 'dev-1',
  ...over,
});

describe('summariseReadings', () => {
  it('summarises temperature, alerts, latest values and device count', () => {
    const summary = summariseReadings([
      reading({ temperature: 4, batteryLevel: 90, atmosphericPressure: 1010 }),
      reading({ temperature: 8, isAlert: true, deviceId: 'dev-2' }),
      reading({ temperature: 5, batteryLevel: 80 }),
      reading({}),
    ]);

    expect(summary).toEqual({
      readingCount: 4,
      alertCount: 1,
      temperature: { min: 4, max: 8, avg: 5.7, latest: 5 },
      latestBattery: 80,
      latestPressure: 1010,
      devices: 2,
    });
  });

  it('keeps a reading of zero rather than skipping it', () => {
    const summary = summariseReadings([reading({ temperature: 3, batteryLevel: 5 }), reading({ temperature: 0, batteryLevel: 0 })]);
    expect(summary.temperature?.latest).toBe(0);
    expect(summary.temperature?.min).toBe(0);
    expect(summary.latestBattery).toBe(0);
  });

  it('returns empty values when there are no readings', () => {
    expect(summariseReadings([])).toEqual({
      readingCount: 0, alertCount: 0, temperature: null, latestBattery: null, latestPressure: null, devices: 0,
    });
  });
});

describe('TelemetryService', () => {
  const window = { limit: 10 };

  it('returns null when the shipment is not in the org', async () => {
    const repo = { listForShipment: jest.fn().mockResolvedValue(null), listForOrder: jest.fn(), listForDevice: jest.fn() };
    const service = new TelemetryService(repo);

    expect(await service.forShipment('org-1', 'ship-foreign', window)).toBeNull();
    expect(repo.listForShipment).toHaveBeenCalledWith('org-1', 'ship-foreign', window);
  });

  it('returns shipment readings with a summary', async () => {
    const rows = [reading({ temperature: 2 })];
    const repo = { listForShipment: jest.fn().mockResolvedValue(rows), listForOrder: jest.fn(), listForDevice: jest.fn() };
    const service = new TelemetryService(repo);

    const result = await service.forShipment('org-1', 'ship-1', window);

    expect(result?.readings).toBe(rows);
    expect(result?.summary.readingCount).toBe(1);
  });

  it('returns null when the order is not in the org', async () => {
    const repo = { listForShipment: jest.fn(), listForOrder: jest.fn().mockResolvedValue(null), listForDevice: jest.fn() };
    const service = new TelemetryService(repo);

    expect(await service.forOrder('org-1', 'order-foreign', window)).toBeNull();
  });
});
