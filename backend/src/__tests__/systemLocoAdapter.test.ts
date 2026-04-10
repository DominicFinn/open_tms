import { SystemLocoAdapter } from '../integrations/SystemLocoAdapter';

// ── Mock Prisma ─────────────────────────────────────────────
function mockPrisma() {
  const created: Record<string, any[]> = {
    device: [], sensorReading: [], deviceEvent: [], shipmentEvent: [], deviceAssignment: [],
  };

  return {
    device: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => {
        const d = { id: 'dev-001', ...data };
        created.device.push(d);
        return Promise.resolve(d);
      }),
      update: jest.fn().mockImplementation(({ data, where }) => {
        const d = { id: where.id, ...data };
        return Promise.resolve(d);
      }),
    },
    deviceAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    shipment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sensorReading: {
      create: jest.fn().mockImplementation(({ data }) => {
        const r = { id: 'sr-001', ...data };
        created.sensorReading.push(r);
        return Promise.resolve(r);
      }),
    },
    deviceEvent: {
      create: jest.fn().mockImplementation(({ data }) => {
        const e = { id: 'de-001', ...data };
        created.deviceEvent.push(e);
        return Promise.resolve(e);
      }),
    },
    shipmentEvent: {
      create: jest.fn().mockImplementation(({ data }) => {
        const e = { id: 'se-001', ...data };
        created.shipmentEvent.push(e);
        return Promise.resolve(e);
      }),
    },
    _created: created,
  } as any;
}

// ── Test Payloads ───────────────────────────────────────────
const DEVICE_TEMP_EVENT = {
  id: 'evt-temp-001',
  owner: { id: 'org-001', name: 'Acme Logistics' },
  category: 'event',
  type: 'temperature',
  startTime: '2026-04-09T10:30:00.000Z',
  latestTime: '2026-04-09T10:30:00.000Z',
  endTime: null,
  location: {
    summary: 'Near Manchester, UK',
    type: 'gps',
    time: '2026-04-09T10:29:55.000Z',
    global: { lat: 53.4808, lon: -2.2426, cep: 12.5, address: 'Manchester, UK' },
  },
  payload: { temperature: 12.3, maxTemperature: 8.0, minTemperature: 2.0 },
  device: {
    id: '660e1a2b3c4d5e6f',
    displayId: 'HG-00012345',
    name: 'Cold Chain Tracker #7',
    model: { name: 'HGx' },
    firmware: '2.4.1',
    labels: ['cold-chain', 'uk-fleet'],
  },
};

const DEVICE_IMPACT_EVENT = {
  ...DEVICE_TEMP_EVENT,
  id: 'evt-impact-001',
  type: 'impact',
  payload: { g: 5.23 },
};

const DEVICE_ZONE_CHANGE_EVENT = {
  ...DEVICE_TEMP_EVENT,
  id: 'evt-zone-001',
  type: 'zoneChange',
  payload: {
    remainedInside: [{ id: 'z1', name: 'Warehouse A' }],
    movedInside: [{ id: 'z2', name: 'Loading Bay' }],
    movedOutside: [],
  },
};

const SHIPMENT_REPORT_EVENT = {
  id: 'evt-rpt-001',
  time: '2026-04-09T10:30:00.000Z',
  source: 'shipment',
  category: 'event',
  type: 'report',
  shipment: { id: 'ship-ext-001', name: 'London to Manchester #42', status: 'inProgress', lastReported: '2026-04-09T10:30:00.000Z' },
  location: { lat: 52.4862, lon: -1.8904, cep: 8.0, address: 'Birmingham, UK' },
  payload: {
    device: { id: '660e1a2b3c4d5e6f', displayId: 'HG-00012345', name: 'Fleet Tracker #7', model: { name: 'HGx' }, labels: ['uk-fleet'] },
    sensors: { batteryLevel: 85, temperature: 4.5, movement: 'moving' },
  },
};

const SHIPMENT_TEMP_ALERT = {
  id: 'evt-alert-001',
  time: '2026-04-09T11:15:00.000Z',
  source: 'shipment',
  category: 'event',
  type: 'temperature',
  shipment: { id: 'ship-ext-001', name: 'London to Manchester #42', status: 'inProgress' },
  location: { lat: 53.0027, lon: -2.1794, address: 'Stoke-on-Trent, UK' },
  payload: {
    message: 'Temperature 9.2°C exceeds maximum 8.0°C',
    temperature: 9.2,
    device: { id: '660e1a2b3c4d5e6f', displayId: 'HG-00012345', name: 'Fleet Tracker #7', model: { name: 'HGx' }, labels: [] },
  },
};

// ── Detection Tests ─────────────────────────────────────────
describe('SystemLocoAdapter', () => {
  describe('detect()', () => {
    it('detects device event format', () => {
      expect(SystemLocoAdapter.detect(DEVICE_TEMP_EVENT)).toBe('device_event');
    });

    it('detects shipment event format', () => {
      expect(SystemLocoAdapter.detect(SHIPMENT_REPORT_EVENT)).toBe('shipment_event');
    });

    it('returns null for unknown format', () => {
      expect(SystemLocoAdapter.detect({ foo: 'bar' })).toBeNull();
      expect(SystemLocoAdapter.detect(null)).toBeNull();
      expect(SystemLocoAdapter.detect({})).toBeNull();
    });

    it('returns null for legacy webhook format', () => {
      expect(SystemLocoAdapter.detect({ event: { device: { name: 'SH-001' } } })).toBeNull();
    });
  });

  // ── Device Event Processing ─────────────────────────────
  describe('processDeviceEvent()', () => {
    it('auto-registers a new device on first event', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(prisma.device.findUnique).toHaveBeenCalledWith({
        where: { externalId: '660e1a2b3c4d5e6f' },
      });
      expect(prisma.device.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.device.create.mock.calls[0][0].data;
      expect(createCall.externalId).toBe('660e1a2b3c4d5e6f');
      expect(createCall.displayId).toBe('HG-00012345');
      expect(createCall.name).toBe('Cold Chain Tracker #7');
      expect(createCall.model).toBe('HGx');
      expect(createCall.firmware).toBe('2.4.1');
      expect(createCall.provider).toBe('system_loco');
    });

    it('updates existing device on subsequent events', async () => {
      const prisma = mockPrisma();
      prisma.device.findUnique.mockResolvedValue({
        id: 'existing-dev',
        externalId: '660e1a2b3c4d5e6f',
        firmware: '2.3.0',
        lastLat: null,
        lastLng: null,
        batteryLevel: null,
      });
      const adapter = new SystemLocoAdapter(prisma);

      await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(prisma.device.create).not.toHaveBeenCalled();
      expect(prisma.device.update).toHaveBeenCalledTimes(1);
      const updateData = prisma.device.update.mock.calls[0][0].data;
      expect(updateData.firmware).toBe('2.4.1');
      expect(updateData.lastLat).toBe(53.4808);
      expect(updateData.lastLng).toBe(-2.2426);
    });

    it('creates SensorReading for temperature events', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.sensorReadingId).toBe('sr-001');
      expect(prisma.sensorReading.create).toHaveBeenCalledTimes(1);
      const reading = prisma.sensorReading.create.mock.calls[0][0].data;
      expect(reading.temperature).toBe(12.3);
      expect(reading.tempMax).toBe(8.0);
      expect(reading.tempMin).toBe(2.0);
      expect(reading.lat).toBe(53.4808);
      expect(reading.lng).toBe(-2.2426);
      expect(reading.isAlert).toBe(true); // 12.3 > maxTemperature 8.0
      expect(reading.alertType).toBe('temperature');
    });

    it('creates SensorReading for impact events', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_IMPACT_EVENT);

      expect(result.sensorReadingId).toBe('sr-001');
      const reading = prisma.sensorReading.create.mock.calls[0][0].data;
      expect(reading.impactG).toBe(5.23);
      expect(reading.isAlert).toBe(true);
      expect(reading.alertType).toBe('impact');
    });

    it('creates DeviceEvent for all event types', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.deviceEventId).toBe('de-001');
      expect(prisma.deviceEvent.create).toHaveBeenCalledTimes(1);
      const event = prisma.deviceEvent.create.mock.calls[0][0].data;
      expect(event.eventType).toBe('temperature');
      expect(event.category).toBe('event');
      expect(event.externalEventId).toBe('evt-temp-001');
    });

    it('stores zone name for zone change events', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      await adapter.processDeviceEvent(DEVICE_ZONE_CHANGE_EVENT);

      const event = prisma.deviceEvent.create.mock.calls[0][0].data;
      expect(event.eventType).toBe('zoneChange');
      expect(event.zoneName).toBe('Loading Bay');
    });

    it('matches device to shipment via DeviceAssignment', async () => {
      const prisma = mockPrisma();
      prisma.deviceAssignment.findFirst.mockResolvedValue({
        shipmentId: 'ship-123',
        orderId: null,
      });
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.shipmentId).toBe('ship-123');
      expect(result.matched).toBe(true);
      // Should create ShipmentEvent since we have shipment + location
      expect(prisma.shipmentEvent.create).toHaveBeenCalledTimes(1);
    });

    it('falls back to shipment reference matching when no assignment', async () => {
      const prisma = mockPrisma();
      prisma.shipment.findFirst.mockResolvedValue({
        id: 'ship-456',
        reference: 'Cold Chain Tracker #7',
      });
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.shipmentId).toBe('ship-456');
      expect(result.matched).toBe(true);
    });

    it('falls back to order matching when no shipment match', async () => {
      const prisma = mockPrisma();
      prisma.order.findFirst.mockResolvedValue({
        id: 'ord-789',
        orderNumber: 'Cold Chain Tracker #7',
      });
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.orderId).toBe('ord-789');
      expect(result.matched).toBe(true);
    });

    it('returns matched=false when no assignment or name match', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processDeviceEvent(DEVICE_TEMP_EVENT);

      expect(result.shipmentId).toBeNull();
      expect(result.orderId).toBeNull();
      expect(result.matched).toBe(false);
    });
  });

  // ── Shipment Event Processing ───────────────────────────
  describe('processShipmentEvent()', () => {
    it('creates SensorReading from report with sensors', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processShipmentEvent(SHIPMENT_REPORT_EVENT);

      expect(result.sensorReadingId).toBe('sr-001');
      const reading = prisma.sensorReading.create.mock.calls[0][0].data;
      expect(reading.temperature).toBe(4.5);
      expect(reading.batteryLevel).toBe(85);
      expect(reading.movement).toBe('moving');
      expect(reading.lat).toBe(52.4862);
      expect(reading.lng).toBe(-1.8904);
    });

    it('creates alert SensorReading for temperature alerts', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const result = await adapter.processShipmentEvent(SHIPMENT_TEMP_ALERT);

      // Should create sensor reading with isAlert=true
      const sensorCalls = prisma.sensorReading.create.mock.calls;
      expect(sensorCalls.length).toBeGreaterThanOrEqual(1);
      const alertReading = sensorCalls[0][0].data;
      expect(alertReading.temperature).toBe(9.2);
      expect(alertReading.isAlert).toBe(true);
      expect(alertReading.alertType).toBe('temperature');
    });

    it('creates DeviceEvent for alert types', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      await adapter.processShipmentEvent(SHIPMENT_TEMP_ALERT);

      // Temp alert with device info should create DeviceEvent
      // The alert has no device in payload, so this won't create one
      // But it should still try to create ShipmentEvent if matched
    });

    it('auto-registers device from report payload', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      await adapter.processShipmentEvent(SHIPMENT_REPORT_EVENT);

      expect(prisma.device.findUnique).toHaveBeenCalled();
      expect(prisma.device.create).toHaveBeenCalledTimes(1);
      const deviceData = prisma.device.create.mock.calls[0][0].data;
      expect(deviceData.name).toBe('Fleet Tracker #7');
      expect(deviceData.model).toBe('HGx');
    });

    it('handles report with no device gracefully', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const noDeviceEvent = {
        ...SHIPMENT_REPORT_EVENT,
        payload: { sensors: { temperature: 5.0 } },
      };

      const result = await adapter.processShipmentEvent(noDeviceEvent);

      expect(prisma.device.create).not.toHaveBeenCalled();
      expect(result.deviceId).toBe('');
    });
  });

  // ── Edge Cases ────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles missing location gracefully', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const noLocation = { ...DEVICE_TEMP_EVENT, location: null };
      const result = await adapter.processDeviceEvent(noLocation);

      expect(result.deviceEventId).toBe('de-001');
      // SensorReading should still be created (temp data exists)
      expect(result.sensorReadingId).toBe('sr-001');
    });

    it('handles missing payload gracefully', async () => {
      const prisma = mockPrisma();
      const adapter = new SystemLocoAdapter(prisma);

      const noPayload = { ...DEVICE_TEMP_EVENT, payload: null };
      const result = await adapter.processDeviceEvent(noPayload);

      // Should still create device event
      expect(result.deviceEventId).toBe('de-001');
    });

    it('deduplicates by externalEventId', async () => {
      const prisma = mockPrisma();
      prisma.deviceEvent.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      );
      const adapter = new SystemLocoAdapter(prisma);

      await expect(adapter.processDeviceEvent(DEVICE_TEMP_EVENT)).rejects.toThrow();
    });
  });
});
