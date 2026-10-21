import { HandlingUnitProjection } from '../../events/projections/HandlingUnitProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';
import type { HandlingUnitSnapshot, IHandlingUnitSource } from '../../ports/handlingUnitSource';

const snapshot = (id: string, overrides: Partial<HandlingUnitSnapshot> = {}): HandlingUnitSnapshot => ({
  orgId: 'test-org',
  sourceType: 'tms_trackable_unit',
  sourceId: id,
  sourceOrderId: 'order-1',
  identifier: `PLT-${id}`,
  unitType: 'pallet',
  customTypeName: null,
  barcode: 'BC-1',
  lines: [{ sourceLineId: 'li-1', sku: 'SKU-1', description: 'Widget', quantity: 10, weight: 5, hazmat: false, temperature: null }],
  ...overrides,
});

function build(snapshots: Record<string, HandlingUnitSnapshot | null> = {}, orderUnits: string[] = []) {
  const prisma = {
    handlingUnit: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    handlingUnitLine: { deleteMany: jest.fn().mockReturnValue('delete'), createMany: jest.fn().mockReturnValue('create') },
    $transaction: jest.fn().mockResolvedValue([]),
  } as any;
  const source: IHandlingUnitSource = {
    getSnapshot: jest.fn(async (_org, id) => (id in snapshots ? snapshots[id] : snapshot(id))),
    listSourceIdsForOrder: jest.fn().mockResolvedValue(orderUnits),
    listSourceIds: jest.fn().mockResolvedValue([]),
  };
  return { prisma, source, projection: new HandlingUnitProjection(prisma, source) };
}

describe('HandlingUnitProjection', () => {
  it('creates the handling unit with the same id as its TMS unit', async () => {
    const { prisma, projection } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_CREATED, 'trackable_unit', 'tu-1', { orderId: 'order-1' }));

    const call = prisma.handlingUnit.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ orgId_sourceType_sourceId: { orgId: 'test-org', sourceType: 'tms_trackable_unit', sourceId: 'tu-1' } });
    expect(call.create).toMatchObject({ id: 'tu-1', orgId: 'test-org', sourceId: 'tu-1', identifier: 'PLT-tu-1', unitType: 'pallet' });
  });

  it('never writes warehouse state, so a replayed event cannot move a pallet', async () => {
    const { prisma, projection } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_UPDATED, 'trackable_unit', 'tu-1', {}));

    const { create, update } = prisma.handlingUnit.upsert.mock.calls[0][0];
    for (const field of ['currentBinId', 'currentZoneId', 'parentHandlingUnitId', 'lotNumber', 'expiryDate', 'receivedAt', 'ownerCustomerId', 'qualityStatus']) {
      expect(update).not.toHaveProperty(field);
      expect(create).not.toHaveProperty(field);
    }
  });

  it('replaces the contents wholesale, within the org', async () => {
    const { prisma, projection } = build();

    await projection.project('test-org', 'tu-1');

    expect(prisma.handlingUnitLine.deleteMany).toHaveBeenCalledWith({ where: { handlingUnitId: 'tu-1', orgId: 'test-org' } });
    expect(prisma.handlingUnitLine.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ handlingUnitId: 'tu-1', orgId: 'test-org', sourceLineId: 'li-1', sku: 'SKU-1', quantity: 10 })],
    });
  });

  it.each([
    [EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED, { fromUnitId: 'tu-a', toUnitId: 'tu-b' }],
    [EVENT_TYPES.TRACKABLE_UNITS_MERGED, { sourceUnitId: 'tu-a', targetUnitId: 'tu-b' }],
    [EVENT_TYPES.TRACKABLE_UNIT_SPLIT, { sourceUnitId: 'tu-a', newUnitId: 'tu-b' }],
  ])('re-projects both units named by %s', async (type, payload) => {
    const { source, projection } = build();

    await projection.handle(createTestEvent(type, 'trackable_unit', 'whatever', payload));

    expect((source.getSnapshot as jest.Mock).mock.calls.map((c) => c[1])).toEqual(['tu-a', 'tu-b']);
  });

  it('re-projects every unit of the order when one of its lines changes', async () => {
    const { source, projection } = build({}, ['tu-1', 'tu-2']);

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_UPDATED, 'order_line_item', 'li-1', { orderId: 'order-1' }));

    expect(source.listSourceIdsForOrder).toHaveBeenCalledWith('test-org', 'order-1');
    expect((source.getSnapshot as jest.Mock).mock.calls.map((c) => c[1])).toEqual(['tu-1', 'tu-2']);
  });

  it('marks a unit removed upstream rather than deleting it', async () => {
    const { prisma, projection } = build({ 'tu-1': null });

    await projection.handle(createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_DELETED, 'trackable_unit', 'tu-1', {}));

    expect(prisma.handlingUnit.upsert).not.toHaveBeenCalled();
    expect(prisma.handlingUnit.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'test-org', sourceType: 'tms_trackable_unit', sourceId: 'tu-1', sourceRemovedAt: null },
      data: { sourceRemovedAt: expect.any(Date) },
    });
  });

  it('marks every unit of a deleted order removed', async () => {
    const { prisma, projection } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_DELETED, 'order', 'order-9', {}));

    expect(prisma.handlingUnit.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'test-org', sourceType: 'tms_trackable_unit', sourceOrderId: 'order-9', sourceRemovedAt: null },
      data: { sourceRemovedAt: expect.any(Date) },
    });
  });

  it('ignores events that do not concern units', async () => {
    const { source, projection } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_CREATED, 'order', 'order-1', {}));

    expect(source.getSnapshot).not.toHaveBeenCalled();
  });
});

describe('HandlingUnitProjection.markMissingRemoved', () => {
  it('marks units whose source has gone, and leaves live ones alone', async () => {
    const { prisma, source, projection } = build({ 'tu-gone': null });
    prisma.handlingUnit.findMany = jest.fn().mockResolvedValue([
      { orgId: 'test-org', sourceId: 'tu-live' },
      { orgId: 'test-org', sourceId: 'tu-gone' },
    ]);

    await projection.markMissingRemoved(new Set(['tu-live']));

    expect((source.getSnapshot as jest.Mock).mock.calls).toEqual([['test-org', 'tu-gone']]);
    expect(prisma.handlingUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sourceId: 'tu-gone' }) })
    );
  });
});
