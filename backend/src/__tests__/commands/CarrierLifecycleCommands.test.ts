import { SoftDeleteCarrierCommandHandler, SOFT_DELETE_CARRIER } from '../../commands/carriers/SoftDeleteCarrierCommand';
import { UnarchiveCarrierCommandHandler, UNARCHIVE_CARRIER } from '../../commands/carriers/UnarchiveCarrierCommand';
import { ArchiveCarrierCommandHandler, ARCHIVE_CARRIER } from '../../commands/carriers/ArchiveCarrierCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { mockEventBus, createTestCommand } from '../helpers/testUtils';

function makeTx(overrides: any = {}) {
  return {
    carrier: {
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme', archived: false, deletedAt: null }),
      update: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme' }),
      ...overrides.carrier,
    },
    laneCarrier: {
      count: jest.fn().mockResolvedValue(0),
      ...overrides.laneCarrier,
    },
    carrierUser: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      ...overrides.carrierUser,
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('SoftDeleteCarrierCommand', () => {
  it('soft-deletes, deactivates portal users, and emits CARRIER_DELETED', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new SoftDeleteCarrierCommandHandler(makePrisma(tx), bus);
    const result = await handler.execute(createTestCommand(SOFT_DELETE_CARRIER, { id: 'car-1' }));

    expect(result.success).toBe(true);
    expect(tx.carrier.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    }));
    expect(tx.carrierUser.updateMany).toHaveBeenCalledWith({ where: { carrierId: 'car-1' }, data: { active: false } });
    expect(result.events.some(e => e.type === EVENT_TYPES.CARRIER_DELETED)).toBe(true);
  });

  it('refuses to delete a carrier assigned to lanes', async () => {
    const tx = makeTx({ laneCarrier: { count: jest.fn().mockResolvedValue(3) } });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteCarrierCommandHandler(makePrisma(tx), bus);
    const result = await handler.execute(createTestCommand(SOFT_DELETE_CARRIER, { id: 'car-1' }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/assigned to one or more lanes/i);
    expect(tx.carrier.update).not.toHaveBeenCalled();
  });

  it('is idempotent for an already-deleted carrier', async () => {
    const tx = makeTx({ carrier: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme', deletedAt: new Date() }) } });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteCarrierCommandHandler(makePrisma(tx), bus);
    const result = await handler.execute(createTestCommand(SOFT_DELETE_CARRIER, { id: 'car-1' }));

    expect(result.success).toBe(true);
    expect((result.data as any).alreadyDeleted).toBe(true);
    expect(tx.carrier.update).not.toHaveBeenCalled();
  });
});

describe('ArchiveCarrierCommand', () => {
  it('archives and deactivates portal users', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new ArchiveCarrierCommandHandler(makePrisma(tx), bus);
    const result = await handler.execute(createTestCommand(ARCHIVE_CARRIER, { id: 'car-1' }));

    expect(result.success).toBe(true);
    expect(tx.carrierUser.updateMany).toHaveBeenCalledWith({ where: { carrierId: 'car-1' }, data: { active: false } });
    expect(result.events.some(e => e.type === EVENT_TYPES.CARRIER_ARCHIVED)).toBe(true);
  });
});

describe('UnarchiveCarrierCommand', () => {
  it('restores an archived carrier, reactivates users, emits CARRIER_UNARCHIVED', async () => {
    const tx = makeTx({ carrier: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme', archived: true, deletedAt: null }), update: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme' }) } });
    const { bus } = mockEventBus();
    const handler = new UnarchiveCarrierCommandHandler(makePrisma(tx), bus);
    const result = await handler.execute(createTestCommand(UNARCHIVE_CARRIER, { id: 'car-1' }));

    expect(result.success).toBe(true);
    expect(tx.carrierUser.updateMany).toHaveBeenCalledWith({ where: { carrierId: 'car-1', anonymizedAt: null }, data: { active: true } });
    expect(result.events.some(e => e.type === EVENT_TYPES.CARRIER_UNARCHIVED)).toBe(true);
  });
});
