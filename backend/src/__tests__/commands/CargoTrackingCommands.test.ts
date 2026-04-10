import { RecordCargoScanCommandHandler, RECORD_CARGO_SCAN } from '../../commands/cargoTracking/RecordCargoScanCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockScan = {
  id: 'scan-1', shipmentId: 'ship-1', shipmentStopId: 'stop-1',
  trackableUnitId: 'tu-1', scanType: 'arrival',
  createdAt: new Date(),
};

const mockTx = {
  cargoScan: { create: jest.fn().mockResolvedValue(mockScan) },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('CargoTracking Command Handlers', () => {
  it('records cargo scan and emits CARGO_SCAN_RECORDED', async () => {
    const { bus } = mockEventBus();
    const handler = new RecordCargoScanCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_CARGO_SCAN, {
        shipmentId: 'ship-1',
        shipmentStopId: 'stop-1',
        trackableUnitId: 'tu-1',
        scanType: 'arrival',
      })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.CARGO_SCAN_RECORDED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({
        shipmentId: 'ship-1',
        trackableUnitId: 'tu-1',
        scanType: 'arrival',
      })
    );
  });
});
