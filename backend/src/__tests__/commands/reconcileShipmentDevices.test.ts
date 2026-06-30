import { reconcileShipmentDevices } from '../../commands/shipments/reconcileShipmentDevices';

function makeTx(current: Array<{ id: string; deviceId: string; externalId: string }>) {
  return {
    deviceAssignment: {
      findMany: jest.fn().mockResolvedValue(
        current.map(a => ({ id: a.id, deviceId: a.deviceId, device: { id: a.deviceId, externalId: a.externalId } }))
      ),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `asn-${data.deviceId}` })),
    },
    device: {
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
      where: { id: 'a2' }, data: expect.objectContaining({ active: false }),
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
      where: { id: 'a1' }, data: expect.objectContaining({ active: false }),
    }));
    expect(s.unassigned).toEqual(['dev-EXT-A']);
  });
});
