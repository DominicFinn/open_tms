import { PgBossEventBus } from '../../events/PgBossEventBus';
import { createTestEvent } from '../helpers/testUtils';

function setup() {
  const subscriptions = new Map<string, (message: any) => Promise<void>>();
  const queue = {
    publish: jest.fn().mockResolvedValue('job-1'),
    subscribe: jest.fn(async (name: string, handler: any) => { subscriptions.set(name, handler); }),
  } as any;
  const prisma = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
  const bus = new PgBossEventBus(prisma, queue);
  const published = () => queue.publish.mock.calls.map((c: any[]) => c[0]);
  return { bus, queue, subscriptions, published };
}

const event = () => createTestEvent('shipment.created', 'shipment', 'ship-1', {});

describe('PgBossEventBus fan-out (#327)', () => {
  it('hands events to the dispatch queue in a process that does not run handlers', async () => {
    const { bus, published } = setup();
    // Routing registered but never started: the API with DISABLE_EMBEDDED_WORKERS=true.
    await bus.subscribe('projection.shipment', ['shipment.*'], jest.fn());

    await bus.publish(event());

    expect(published()).toEqual(['evt.__dispatch']);
  });

  it('fans out directly to matching handler queues in a process that runs handlers', async () => {
    const { bus, published, subscriptions } = setup();
    await bus.subscribe('projection.shipment', ['shipment.*'], jest.fn());
    await bus.subscribe('projection.order', ['order.*'], jest.fn());
    await bus.start();

    await bus.publish(event());

    expect(published()).toEqual(['evt.projection.shipment']);
    expect([...subscriptions.keys()]).toEqual(['evt.projection.shipment', 'evt.projection.order', 'evt.__dispatch']);
  });

  it('fans dispatched events out to its own handler queues', async () => {
    const { bus, published, subscriptions } = setup();
    await bus.subscribe('audit', ['*'], jest.fn());
    await bus.start();

    await subscriptions.get('evt.__dispatch')!({ type: 'shipment.created', payload: event() });

    expect(published()).toEqual(['evt.audit']);
  });

  it('keeps dispatching when started with no handlers, so nothing is dropped', async () => {
    const { bus, published, subscriptions } = setup();
    await bus.start();

    await bus.publish(event());

    expect(published()).toEqual(['evt.__dispatch']);
    expect(subscriptions.has('evt.__dispatch')).toBe(false);
  });
});
