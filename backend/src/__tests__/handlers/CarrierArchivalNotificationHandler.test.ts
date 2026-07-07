import { CarrierArchivalNotificationHandler } from '../../events/handlers/CarrierArchivalNotificationHandler';
import { EVENT_TYPES } from '../../events/eventTypes';

function makeHandler(users: any[]) {
  const published: any[] = [];
  const prisma = {
    carrier: { findUnique: jest.fn().mockResolvedValue({ id: 'car-1', name: 'Acme' }) },
    carrierUser: { findMany: jest.fn().mockResolvedValue(users) },
  } as any;
  const eventBus = { publish: jest.fn().mockImplementation((e: any) => { published.push(e); return Promise.resolve(); }) } as any;
  return { handler: new CarrierArchivalNotificationHandler(prisma, eventBus), prisma, published };
}

const archivedEvent = { type: EVENT_TYPES.CARRIER_ARCHIVED, orgId: 'org-1', entityId: 'car-1', entityType: 'carrier', payload: {} } as any;

describe('CarrierArchivalNotificationHandler', () => {
  it('notifies all portal users and emits an auditable carrier.users_notified event', async () => {
    const { handler, published } = makeHandler([
      { id: 'u1', email: 'a@c.demo', name: 'A' },
      { id: 'u2', email: 'b@c.demo', name: 'B' },
    ]);
    await handler.handle(archivedEvent);

    expect(published).toHaveLength(1);
    expect(published[0].type).toBe(EVENT_TYPES.CARRIER_USERS_NOTIFIED);
    expect(published[0].payload.recipientCount).toBe(2);
    expect(published[0].payload.recipients).toEqual(['a@c.demo', 'b@c.demo']);
    expect(published[0].payload.reason).toBe('archived');
    expect(published[0].payload.delivery).toBe('stubbed');
  });

  it('excludes anonymised users (query filters anonymizedAt: null)', async () => {
    const { handler, prisma } = makeHandler([{ id: 'u1', email: 'a@c.demo', name: 'A' }]);
    await handler.handle(archivedEvent);
    expect(prisma.carrierUser.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { carrierId: 'car-1', anonymizedAt: null },
    }));
  });

  it('does nothing when the carrier has no users', async () => {
    const { handler, published } = makeHandler([]);
    await handler.handle(archivedEvent);
    expect(published).toHaveLength(0);
  });

  it('records the reason as "deleted" for a delete event', async () => {
    const { handler, published } = makeHandler([{ id: 'u1', email: 'a@c.demo', name: 'A' }]);
    await handler.handle({ ...archivedEvent, type: EVENT_TYPES.CARRIER_DELETED });
    expect(published[0].payload.reason).toBe('deleted');
  });
});
