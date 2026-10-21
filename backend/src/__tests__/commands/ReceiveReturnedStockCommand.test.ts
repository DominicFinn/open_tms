import { ReceiveReturnedStockCommandHandler, RECEIVE_RETURNED_STOCK } from '../../commands/inventory/ReceiveReturnedStockCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function build({ bin = { id: 'bin-r', locationId: 'loc-1', facilityId: 'fac-1' } as any, existing = null as any } = {}) {
  const tx = {
    warehouseBin: { findFirst: jest.fn().mockResolvedValue(bin) },
    inventoryRecord: {
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({ id: 'inv-new' }),
      update: jest.fn().mockResolvedValue({ id: existing?.id ?? 'inv-1' }),
    },
    inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
  return { tx, prisma, handler: new ReceiveReturnedStockCommandHandler(prisma, mockEventBus().bus) };
}

const payload = { binId: 'bin-r', sku: 'SKU-A', quantity: 2, rmaId: 'rma-1', rmaLineId: 'line-1', handlingUnitId: 'hu-1' };

describe('ReceiveReturnedStockCommandHandler', () => {
  it('creates a stock record in the bin and its facility, and a return ledger entry', async () => {
    const { tx, handler } = build();

    const result = await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, payload));

    expect(result.success).toBe(true);
    expect(tx.warehouseBin.findFirst.mock.calls[0][0].where).toEqual({ id: 'bin-r', orgId: 'test-org' });
    expect(tx.inventoryRecord.create.mock.calls[0][0].data).toMatchObject({ binId: 'bin-r', facilityId: 'fac-1', sku: 'SKU-A', quantityOnHand: 2, orgId: 'test-org' });
    expect(tx.inventoryTransaction.create.mock.calls[0][0].data).toMatchObject({
      transactionType: 'receive', reasonCode: 'return', referenceType: 'rma', referenceId: 'rma-1',
      quantityChange: 2, previousQuantity: 0, newQuantity: 2, handlingUnitId: 'hu-1',
    });
  });

  it('adds to an existing record rather than creating another', async () => {
    const { tx, handler } = build({ existing: { id: 'inv-1', quantityOnHand: 5 } });

    await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, payload));

    expect(tx.inventoryRecord.create).not.toHaveBeenCalled();
    expect(tx.inventoryRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inv-1', orgId: 'test-org' },
      data: { quantityOnHand: { increment: 2 }, quantityAvailable: { increment: 2 } },
    }));
    expect(tx.inventoryTransaction.create.mock.calls[0][0].data).toMatchObject({ previousQuantity: 5, newQuantity: 7 });
  });

  it('emits inventory.return_received carrying the RMA line, under the command correlation id', async () => {
    const { handler } = build();

    const result = await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, payload, { metadata: { correlationId: 'rma-restock:line-1', source: 'event' } } as any));

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.INVENTORY_RETURN_RECEIVED, payload: { rmaLineId: 'line-1', quantity: 2 } });
    expect(result.events[0].metadata.correlationId).toBe('rma-restock:line-1');
  });

  it('refuses a bin outside the org and writes nothing', async () => {
    const { tx, handler } = build({ bin: null });

    const result = await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, payload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.inventoryRecord.create).not.toHaveBeenCalled();
  });

  it('refuses a non-positive quantity', async () => {
    const { handler } = build();

    const result = await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, { ...payload, quantity: 0 }));

    expect(result.success).toBe(false);
  });

  it('does nothing a second time for the same idempotency key', async () => {
    const { prisma, tx, handler } = build();
    prisma.domainEventLog.findFirst.mockResolvedValue({ id: 'evt-earlier' });

    const result = await handler.execute(createTestCommand(RECEIVE_RETURNED_STOCK, payload, { metadata: { correlationId: 'k', idempotencyKey: 'rma-restock:line-1', source: 'event' } } as any));

    expect(result.success).toBe(true);
    expect(tx.inventoryRecord.create).not.toHaveBeenCalled();
  });
});
