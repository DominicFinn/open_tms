import { WarehouseReturnsStockHandler } from '../../events/handlers/WarehouseReturnsStockHandler';
import { RECEIVE_RETURNED_STOCK } from '../../commands/inventory/ReceiveReturnedStockCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const event = (payload: any) => createTestEvent(EVENT_TYPES.RMA_RESTOCK_REQUESTED, 'rma_line', 'line-1', payload);
const payload = { rmaId: 'rma-1', rmaLineId: 'line-1', sku: 'SKU-A', quantity: 2, binId: 'bin-r', unitId: 'hu-1' };

describe('WarehouseReturnsStockHandler', () => {
  it('dispatches the restock with an idempotency key per RMA line', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue({ success: true }) } as any;

    await new WarehouseReturnsStockHandler(bus).handle(event(payload));

    expect(bus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: RECEIVE_RETURNED_STOCK,
      orgId: 'test-org',
      payload: { binId: 'bin-r', sku: 'SKU-A', quantity: 2, rmaId: 'rma-1', rmaLineId: 'line-1', handlingUnitId: 'hu-1' },
      metadata: expect.objectContaining({ correlationId: 'rma-restock:line-1', idempotencyKey: 'rma-restock:line-1' }),
    }));
  });

  it('throws when the restock fails, so the queue retries it', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue({ success: false, error: 'Bin bin-r not found' }) } as any;

    await expect(new WarehouseReturnsStockHandler(bus).handle(event(payload))).rejects.toThrow('not found');
  });

  it('ignores an incomplete request', async () => {
    const bus = { dispatch: jest.fn() } as any;

    await new WarehouseReturnsStockHandler(bus).handle(event({ ...payload, quantity: 0 }));

    expect(bus.dispatch).not.toHaveBeenCalled();
  });
});
