import { DEVICE_UNAVAILABLE, reconcileShipmentDevices } from '../../commands/shipments/reconcileShipmentDevices';

function makeTx(
  current: Array<{ id: string; deviceId: string; externalId: string }>,
  owners: Record<string, string> = {},
  activeElsewhere: Record<string, string[]> = {},
) {
  return {
    deviceAssignment: {
      // The shipment's current assignments, or a device's active assignments when releasing it.
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        where.shipmentId
          ? current.map(a => ({ id: a.id, deviceId: a.deviceId, device: { id: a.deviceId, externalId: a.externalId } }))
          : (activeElsewhere[where.deviceId] ?? []).map(id => ({ id }))
      )),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `asn-${data.deviceId}` })),
    },
    device: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(owners[where.externalId] ? { orgId: owners[where.externalId] } : null)),
      upsert: jest.fn().mockImplementation(({ where }: any) => Promise.resolve({ id: `dev-${where.externalId}` })),
    },
  } as any;
}

function spies() {
  const assigned: string[] = [];
  const unassigned: string[] = [];
  return {
    assigned, unassigned,
    emitAssigned: (deviceId: string) => assigned.push(deviceId),
    emitUnassigned: (deviceId: string) => unassigned.push(deviceId),
  };
}

describe('reconcileShipmentDevices', () => {
  it('creates a Device + active assignment for each new device', async () => {
    const tx = makeTx([]);
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1',
      devices: [{ name: 'A', externalId: 'EXT-A' }, { name: 'B', externalId: 'EXT-B' }],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    expect(tx.device.upsert).toHaveBeenCalledTimes(2);
    expect(tx.deviceAssignment.create).toHaveBeenCalledTimes(2);
    expect(s.assigned.sort()).toEqual(['dev-EXT-A', 'dev-EXT-B']);
    expect(s.unassigned).toEqual([]);
  });

  it('is a no-op when devices is undefined', async () => {
    const tx = makeTx([{ id: 'a1', deviceId: 'dev-EXT-A', externalId: 'EXT-A' }]);
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1', devices: undefined,
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    expect(tx.deviceAssignment.findMany).not.toHaveBeenCalled();
    expect(tx.deviceAssignment.create).not.toHaveBeenCalled();
  });

  it('is idempotent when the desired list matches the current assignments', async () => {
    const tx = makeTx([
      { id: 'a1', deviceId: 'dev-EXT-A', externalId: 'EXT-A' },
      { id: 'a2', deviceId: 'dev-EXT-B', externalId: 'EXT-B' },
    ]);
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1',
      devices: [{ name: 'A', externalId: 'EXT-A' }, { name: 'B', externalId: 'EXT-B' }],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    expect(tx.deviceAssignment.create).not.toHaveBeenCalled();
    expect(tx.deviceAssignment.update).not.toHaveBeenCalled(); // no removals
    expect(s.assigned).toEqual([]);
    expect(s.unassigned).toEqual([]);
  });

  it('adds new devices and deactivates dropped ones on edit', async () => {
    const tx = makeTx([
      { id: 'a1', deviceId: 'dev-EXT-A', externalId: 'EXT-A' },
      { id: 'a2', deviceId: 'dev-EXT-B', externalId: 'EXT-B' },
    ]);
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1',
      devices: [{ name: 'A', externalId: 'EXT-A' }, { name: 'C', externalId: 'EXT-C' }],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    // B dropped → deactivated
    expect(tx.deviceAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a2', device: { orgId: 'org-1' } }, data: expect.objectContaining({ active: false }),
    }));
    expect(s.unassigned).toEqual(['dev-EXT-B']);
    // C added
    expect(s.assigned).toEqual(['dev-EXT-C']);
  });

  it('removes all devices when given an empty list', async () => {
    const tx = makeTx([{ id: 'a1', deviceId: 'dev-EXT-A', externalId: 'EXT-A' }]);
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1', devices: [],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    expect(tx.deviceAssignment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'a1', device: { orgId: 'org-1' } }, data: expect.objectContaining({ active: false }),
    }));
    expect(s.unassigned).toEqual(['dev-EXT-A']);
  });

  it('releases a device from its assignment elsewhere and emits unassigned for it', async () => {
    const tx = makeTx([], { 'EXT-A': 'org-1' }, { 'dev-EXT-A': ['old-asn'] });
    const s = spies();
    await reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1', devices: [{ name: 'A', externalId: 'EXT-A' }],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    });
    expect(tx.deviceAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['old-asn'] } }, data: expect.objectContaining({ active: false }),
    }));
    expect(s.unassigned).toEqual(['dev-EXT-A']);
    expect(s.assigned).toEqual(['dev-EXT-A']);
  });

  it("refuses a device registered to another org and leaves it untouched", async () => {
    const tx = makeTx([], { 'EXT-A': 'org-2' });
    const s = spies();
    await expect(reconcileShipmentDevices(tx, {
      orgId: 'org-1', shipmentId: 'ship-1', devices: [{ name: 'A', externalId: 'EXT-A' }],
      emitAssigned: s.emitAssigned, emitUnassigned: s.emitUnassigned,
    })).rejects.toThrow(DEVICE_UNAVAILABLE);
    expect(tx.device.upsert).not.toHaveBeenCalled();
    expect(tx.deviceAssignment.create).not.toHaveBeenCalled();
  });
});
