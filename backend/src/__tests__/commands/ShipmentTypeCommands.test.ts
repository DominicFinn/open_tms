import { CreateShipmentTypeCommandHandler, CREATE_SHIPMENT_TYPE } from '../../commands/shipmentTypes/CreateShipmentTypeCommand';
import { UpdateShipmentTypeCommandHandler, UPDATE_SHIPMENT_TYPE } from '../../commands/shipmentTypes/UpdateShipmentTypeCommand';
import { ArchiveShipmentTypeCommandHandler, ARCHIVE_SHIPMENT_TYPE } from '../../commands/shipmentTypes/ArchiveShipmentTypeCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseRow = {
  id: 'st-1',
  orgId: 'test-org',
  name: 'Cold Chain',
  icon: 'ac_unit',
  color: '#0EA5E9',
  description: null,
  defaults: {},
  requiredFields: ['customerId', 'originId', 'destinationId'],
  isBuiltIn: false,
  archived: false,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTx = {
  shipmentType: {
    create: jest.fn().mockResolvedValue(baseRow),
    update: jest.fn().mockResolvedValue(baseRow),
    // Org-aware: a row is only found when the where clause names its org.
    findFirst: jest.fn().mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === baseRow.id && where.orgId === baseRow.orgId ? baseRow : null),
    ),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('ShipmentType command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateShipmentTypeCommandHandler', () => {
    it('creates a type and emits SHIPMENT_TYPE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(
        createTestCommand(CREATE_SHIPMENT_TYPE, {
          name: 'Cold Chain', icon: 'ac_unit', color: '#0EA5E9',
          requiredFields: ['customerId', 'originId', 'destinationId'],
        })
      );
      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_TYPE_CREATED);
      expect(result.events[0].entityType).toBe('shipment_type');
      expect(mockTx.shipmentType.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ orgId: 'test-org', name: 'Cold Chain', icon: 'ac_unit' }),
      }));
    });

    it('applies sensible defaults for icon and color when not provided', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateShipmentTypeCommandHandler(mockPrisma, bus);
      await handler.execute(createTestCommand(CREATE_SHIPMENT_TYPE, { name: 'Plain' }));
      expect(mockTx.shipmentType.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ icon: 'local_shipping', color: '#6366F1', requiredFields: [] }),
      }));
    });
  });

  describe('UpdateShipmentTypeCommandHandler', () => {
    it('updates only provided fields and reports changed keys', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_TYPE, { id: 'st-1', data: { name: 'Reefer', color: '#FF0000' } })
      );
      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_TYPE_UPDATED);
      expect(result.events[0].payload).toEqual(expect.objectContaining({ changes: expect.arrayContaining(['name', 'color']) }));
      expect(mockTx.shipmentType.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'st-1', orgId: 'test-org' },
        data: expect.objectContaining({ name: 'Reefer', color: '#FF0000' }),
      }));
    });

    it('does not include unset fields in the update', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentTypeCommandHandler(mockPrisma, bus);
      await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_TYPE, { id: 'st-1', data: { icon: 'warning' } })
      );
      const call = mockTx.shipmentType.update.mock.calls[0][0];
      expect(Object.keys(call.data)).toEqual(['icon']);
    });

    it('treats another org\'s type as not found', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(
        createTestCommand(UPDATE_SHIPMENT_TYPE, { id: 'st-1', data: { name: 'Hijacked' } }, { orgId: 'other-org' })
      );
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/);
      expect(result.events).toHaveLength(0);
      expect(mockTx.shipmentType.update).not.toHaveBeenCalled();
    });
  });

  describe('ArchiveShipmentTypeCommandHandler', () => {
    it('archives a non-built-in type', async () => {
      mockTx.shipmentType.findFirst.mockResolvedValueOnce({ ...baseRow, isBuiltIn: false });
      mockTx.shipmentType.update.mockResolvedValueOnce({ ...baseRow, archived: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(createTestCommand(ARCHIVE_SHIPMENT_TYPE, { id: 'st-1' }));
      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_TYPE_ARCHIVED);
    });

    it('refuses to archive a built-in type', async () => {
      mockTx.shipmentType.findFirst.mockResolvedValueOnce({ ...baseRow, isBuiltIn: true });
      const { bus } = mockEventBus();
      const handler = new ArchiveShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(createTestCommand(ARCHIVE_SHIPMENT_TYPE, { id: 'st-1' }));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Built-in/);
      expect(mockTx.shipmentType.update).not.toHaveBeenCalled();
    });

    it('treats another org\'s type as not found', async () => {
      const { bus } = mockEventBus();
      const handler = new ArchiveShipmentTypeCommandHandler(mockPrisma, bus);
      const result = await handler.execute(createTestCommand(ARCHIVE_SHIPMENT_TYPE, { id: 'st-1' }, { orgId: 'other-org' }));
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/);
      expect(mockTx.shipmentType.update).not.toHaveBeenCalled();
    });
  });
});
