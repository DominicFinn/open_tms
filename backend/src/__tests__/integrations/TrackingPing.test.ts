import { parseGenericPing, parseSystemLocoPing } from '../../integrations/tracking/TrackingPing';

describe('parseGenericPing', () => {
  const receivedAt = new Date('2026-02-01T00:00:00.000Z');

  it('reads device, device time, position and a readings array', () => {
    const ping = parseGenericPing({
      event: {
        device: { id: 42, name: 'TRUCK-1' },
        startTime: '2026-01-01T08:00:00.000Z',
        location: { global: { lat: '40.1', lon: '-74.2', address: 'Somewhere', cep: 15 } },
        readings: [
          { time: '2026-01-01T07:55:00.000Z', temperature: 4.4 },
          { time: '2026-01-01T08:00:00.000Z', temperature: 4.6, battery: 87 },
          { time: '2026-01-01T08:00:00.000Z' },
        ],
      },
    }, receivedAt);

    expect(ping.deviceExternalId).toBe('42');
    expect(ping.eventTime.toISOString()).toBe('2026-01-01T08:00:00.000Z');
    expect(ping.position).toEqual({ lat: 40.1, lng: -74.2, address: 'Somewhere', accuracyMeters: 15 });
    expect(ping.readings).toHaveLength(2);
    expect(ping.readings[1]).toEqual(expect.objectContaining({ temperature: 4.6, batteryLevel: 87 }));
    expect(ping.readingsCount).toBe(2);
  });

  it('reads a single reading from a sensors block, and keeps a larger device-reported count', () => {
    const ping = parseGenericPing({
      device: { name: 'TRUCK-1' },
      location: { lat: 1, lng: 2 },
      sensors: { temperature: -18.5, batteryLevel: 60 },
      readingsCount: 12,
    }, receivedAt);

    expect(ping.position).toEqual(expect.objectContaining({ lat: 1, lng: 2 }));
    expect(ping.readings).toEqual([expect.objectContaining({ temperature: -18.5, batteryLevel: 60, recordedAt: receivedAt })]);
    expect(ping.readingsCount).toBe(12);
  });

  it('falls back to receipt time and no position when the payload has neither', () => {
    const ping = parseGenericPing({ event: { device: { name: 'X' } } }, receivedAt);
    expect(ping.eventTime).toBe(receivedAt);
    expect(ping.position).toBeUndefined();
    expect(ping.readings).toEqual([]);
    expect(ping.eventType).toBe('location');
  });

  it('accepts a zero coordinate', () => {
    const ping = parseGenericPing({ event: { device: { name: 'X' }, location: { lat: 0, lng: 0 } } }, receivedAt);
    expect(ping.position).toEqual(expect.objectContaining({ lat: 0, lng: 0 }));
  });
});

describe('parseSystemLocoPing', () => {
  it('reads the device time and global location of a device event', () => {
    const ping = parseSystemLocoPing({
      type: 'temperature',
      owner: 'o',
      startTime: '2026-01-01T08:00:00.000Z',
      device: { id: 'abc', name: 'HG-1' },
      location: { global: { lat: 51.5, lon: -0.1 } },
      payload: { temperature: 5.2 },
    });
    expect(ping.deviceExternalId).toBe('abc');
    expect(ping.eventTime.toISOString()).toBe('2026-01-01T08:00:00.000Z');
    expect(ping.position).toEqual(expect.objectContaining({ lat: 51.5, lng: -0.1 }));
    expect(ping.readings).toEqual([expect.objectContaining({ temperature: 5.2 })]);
  });
});
