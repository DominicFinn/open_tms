import {
  RecordCargoScanCommandHandler,
  RECORD_CARGO_SCAN,
  ReconcileStopCargoCommandHandler,
  RECONCILE_STOP_CARGO,
  CheckLeftOnVehicleCommandHandler,
  CHECK_LEFT_ON_VEHICLE,
  UpdateCargoDiscrepancyCommandHandler,
  UPDATE_CARGO_DISCREPANCY,
} from '../../commands/cargoTracking';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

// Org-aware finder: a row comes back only when the where clause's org (direct, via shipment or via
// order) matches, the way the real scoped queries behave.
function orgAware<T extends { id: string; orgId: string }>(rows: T[]) {
  return jest.fn(({ where }: any) => {
    const org = where.orgId ?? where.shipment?.orgId ?? where.order?.orgId;
    return Promise.resolve(rows.find((r) => r.id === where.id && r.orgId === org) ?? null);
  });
}

const unit = (id: string, extra: Record<string, unknown> = {}) => ({
  id, unitType: 'pallet', identifier: `P-${id}`, orderId: 'order-1', currentStopId: null, ...extra,
});

function buildTx() {
  const stop = {
    id: 'stop-1', orgId: 'org-a', shipmentId: 'ship-1', sequenceNumber: 1,
    location: { name: 'Depot A' },
    orders: [{ orderNumber: 'ORD-1', trackableUnits: [unit('tu-1'), unit('tu-2')] }],
    cargoScans: [{ trackableUnitId: 'tu-1' }],
  };
  const stray = {
    ...unit('tu-9'), orgId: 'org-a',
    order: { orderNumber: 'ORD-9', deliveryStopId: 'stop-2', deliveryStop: { sequenceNumber: 2, location: { name: 'Depot B' } } },
  };
  return {
    shipmentStop: {
      findFirst: orgAware([stop]),
      findMany: jest.fn().mockResolvedValue([{ status: 'completed' }, { status: 'skipped' }]),
    },
    shipment: { findFirst: orgAware([{ id: 'ship-1', orgId: 'org-a' }]) },
    trackableUnit: {
      findFirst: orgAware([{ ...unit('tu-1'), orgId: 'org-a', order: { orderNumber: 'ORD-1', deliveryStopId: 'stop-1', deliveryStop: null } }, stray]),
      update: jest.fn().mockResolvedValue({}),
    },
    orderShipment: {
      findMany: jest.fn().mockResolvedValue([
        { order: { orderNumber: 'ORD-1', deliveryStopId: 'stop-1', trackableUnits: [unit('tu-1', { currentStopId: 'stop-1' }), unit('tu-2')] } },
      ]),
    },
    cargoScan: { create: jest.fn(({ data }: any) => Promise.resolve({ id: 'scan-1', ...data })) },
    cargoDiscrepancy: {
      create: jest.fn(({ data }: any) => Promise.resolve({ id: 'disc-new', ...data })),
      findFirst: orgAware([{ id: 'disc-1', orgId: 'org-a', status: 'open' }]),
      update: jest.fn(({ where, data }: any) => Promise.resolve({
        id: where.id, ...data, shipmentId: 'ship-1', trackableUnitId: 'tu-1', discrepancyType: 'missing_at_stop',
        trackableUnit: { identifier: 'P-tu-1', unitType: 'pallet' },
      })),
    },
    domainEventLog: { create: jest.fn() },
  } as any;
}

function buildPrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

const scanPayload = {
  shipmentId: 'ship-1', shipmentStopId: 'stop-1', trackableUnitId: 'tu-1',
  scanType: 'load' as const, scanMethod: 'barcode' as const,
};

describe('RecordCargoScanCommandHandler', () => {
  it('records the scan under the command org and emits CARGO_SCAN_RECORDED', async () => {
    const tx = buildTx();
    const { bus, persisted } = mockEventBus();
    const command = createTestCommand(RECORD_CARGO_SCAN, scanPayload, { orgId: 'org-a', actorId: 'user-7' });

    const result = await new RecordCargoScanCommandHandler(buildPrisma(tx), bus).execute(command);

    expect(result.success).toBe(true);
    expect(tx.cargoScan.create).toHaveBeenCalledWith({ data: expect.objectContaining({ orgId: 'org-a', expected: true }) });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toEqual(expect.objectContaining({
      type: EVENT_TYPES.CARGO_SCAN_RECORDED,
      orgId: 'org-a',
      actorId: 'user-7',
      metadata: expect.objectContaining({ correlationId: command.metadata.correlationId }),
    }));
  });

  it('raises a misdrop discrepancy when a unit is unloaded at a stop it was not bound for', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new RecordCargoScanCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(RECORD_CARGO_SCAN, { ...scanPayload, trackableUnitId: 'tu-9', scanType: 'unload' as const }, { orgId: 'org-a' }),
    );

    expect(result.success).toBe(true);
    expect(tx.cargoDiscrepancy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: 'org-a', discrepancyType: 'misdrop_early', actualStopId: 'stop-1' }),
    });
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.CARGO_SCAN_RECORDED, EVENT_TYPES.CARGO_MISDROP_DETECTED]);
    expect(result.events.every((e) => e.orgId === 'org-a')).toBe(true);
  });

  it('fails without writing when the stop belongs to another org', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new RecordCargoScanCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(RECORD_CARGO_SCAN, scanPayload, { orgId: 'org-b' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Shipment stop not found');
    expect(tx.cargoScan.create).not.toHaveBeenCalled();
  });

  it('fails when the stop is not on the stated shipment', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new RecordCargoScanCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(RECORD_CARGO_SCAN, { ...scanPayload, shipmentId: 'ship-other' }, { orgId: 'org-a' }),
    );

    expect(result.success).toBe(false);
    expect(tx.cargoScan.create).not.toHaveBeenCalled();
  });
});

describe('ReconcileStopCargoCommandHandler', () => {
  it('raises missing_at_stop for expected units that were never scanned', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();
    const command = createTestCommand(RECONCILE_STOP_CARGO, { shipmentStopId: 'stop-1' }, { orgId: 'org-a' });

    const result = await new ReconcileStopCargoCommandHandler(buildPrisma(tx), bus).execute(command);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.objectContaining({ missingUnits: ['tu-2'], discrepanciesCreated: 1 }));
    expect(tx.cargoDiscrepancy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: 'org-a', trackableUnitId: 'tu-2', discrepancyType: 'missing_at_stop' }),
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(expect.objectContaining({
      type: EVENT_TYPES.CARGO_MISSING_AT_STOP,
      orgId: 'org-a',
      metadata: expect.objectContaining({ correlationId: command.metadata.correlationId }),
    }));
  });

  it('auto-scans every expected unit first when completed automatically', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new ReconcileStopCargoCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(RECONCILE_STOP_CARGO, { shipmentStopId: 'stop-1', autoScanMethod: 'geofence' }, { orgId: 'org-a' }),
    );

    expect(result.success).toBe(true);
    expect(tx.cargoScan.create).toHaveBeenCalledTimes(2);
    expect(tx.cargoScan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: 'org-a', scanMethod: 'geofence', scanType: 'unload' }),
    });
  });

  it('fails for a stop in another org', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new ReconcileStopCargoCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(RECONCILE_STOP_CARGO, { shipmentStopId: 'stop-1' }, { orgId: 'org-b' }),
    );

    expect(result.success).toBe(false);
    expect(tx.cargoDiscrepancy.create).not.toHaveBeenCalled();
  });
});

describe('CheckLeftOnVehicleCommandHandler', () => {
  it('raises left_on_vehicle for units never confirmed delivered', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new CheckLeftOnVehicleCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(CHECK_LEFT_ON_VEHICLE, { shipmentId: 'ship-1' }, { orgId: 'org-a', actorId: 'user-7' }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.leftOnVehicle).toEqual(['tu-2']);
    expect(tx.cargoDiscrepancy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ orgId: 'org-a', discrepancyType: 'left_on_vehicle', severity: 'critical' }),
    });
    expect(result.events[0]).toEqual(expect.objectContaining({
      type: EVENT_TYPES.CARGO_LEFT_ON_VEHICLE, orgId: 'org-a', actorId: 'user-7',
    }));
  });

  it('does nothing while stops are still open', async () => {
    const tx = buildTx();
    tx.shipmentStop.findMany.mockResolvedValue([{ status: 'completed' }, { status: 'pending' }]);
    const { bus } = mockEventBus();

    const result = await new CheckLeftOnVehicleCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(CHECK_LEFT_ON_VEHICLE, { shipmentId: 'ship-1' }, { orgId: 'org-a' }),
    );

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(tx.cargoDiscrepancy.create).not.toHaveBeenCalled();
  });

  it('fails for a shipment in another org', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new CheckLeftOnVehicleCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(CHECK_LEFT_ON_VEHICLE, { shipmentId: 'ship-1' }, { orgId: 'org-b' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Shipment not found');
  });
});

describe('UpdateCargoDiscrepancyCommandHandler', () => {
  it('emits CARGO_DISCREPANCY_RESOLVED with the real org and actor on resolution', async () => {
    const tx = buildTx();
    const { bus, persisted } = mockEventBus();
    const command = createTestCommand(
      UPDATE_CARGO_DISCREPANCY,
      { id: 'disc-1', status: 'resolved' as const, resolution: 'Found on the next pallet' },
      { orgId: 'org-a', actorId: 'user-7' },
    );

    const result = await new UpdateCargoDiscrepancyCommandHandler(buildPrisma(tx), bus).execute(command);

    expect(result.success).toBe(true);
    expect(tx.cargoDiscrepancy.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'resolved', resolvedBy: 'user-7', resolvedAt: expect.any(Date) }),
    }));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toEqual(expect.objectContaining({
      type: EVENT_TYPES.CARGO_DISCREPANCY_RESOLVED,
      orgId: 'org-a',
      actorId: 'user-7',
      entityId: 'disc-1',
      metadata: expect.objectContaining({ correlationId: command.metadata.correlationId }),
    }));
  });

  it('emits nothing for an edit that does not resolve', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new UpdateCargoDiscrepancyCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(UPDATE_CARGO_DISCREPANCY, { id: 'disc-1', notes: 'Chasing the driver' }, { orgId: 'org-a' }),
    );

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(0);
  });

  it('fails without updating a discrepancy in another org', async () => {
    const tx = buildTx();
    const { bus } = mockEventBus();

    const result = await new UpdateCargoDiscrepancyCommandHandler(buildPrisma(tx), bus).execute(
      createTestCommand(UPDATE_CARGO_DISCREPANCY, { id: 'disc-1', status: 'resolved' as const }, { orgId: 'org-b' }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Discrepancy not found');
    expect(tx.cargoDiscrepancy.update).not.toHaveBeenCalled();
  });
});
