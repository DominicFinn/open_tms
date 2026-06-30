/**
 * Regression test for the dead-letter ordering bug (#87).
 *
 * pg-boss v10+ rejects createQueue({ deadLetter }) when the referenced
 * dead-letter queue does not exist yet. The adapter MUST create the DLQ
 * before the main queue, otherwise every dynamic evt.* handler queue fails
 * to be created and domain events are silently dropped — new shipments
 * never reach the read model / list view.
 */

const createQueueCalls: Array<{ name: string; opts: any }> = [];
const sendCalls: Array<{ name: string }> = [];
const workCalls: Array<{ name: string }> = [];

class MockPgBoss {
  on() {}
  async start() {}
  async stop() {}
  async createQueue(name: string, opts: any) {
    // Mirror pg-boss v12: reject if the deadLetter target was not created first.
    if (opts?.deadLetter && !createQueueCalls.some(c => c.name === opts.deadLetter)) {
      throw new Error(`Queue ${opts.deadLetter} does not exist`);
    }
    createQueueCalls.push({ name, opts });
  }
  async send(name: string) {
    if (!createQueueCalls.some(c => c.name === name)) {
      throw new Error(`Queue ${name} does not exist`);
    }
    sendCalls.push({ name });
    return 'job-1';
  }
  async work(name: string) {
    if (!createQueueCalls.some(c => c.name === name)) {
      throw new Error(`Queue ${name} does not exist`);
    }
    workCalls.push({ name });
  }
}

jest.mock('pg-boss', () => ({ PgBoss: MockPgBoss }));

// Import AFTER the mock is registered.
import { PgBossQueueAdapter } from '../../queue/PgBossQueueAdapter';

describe('PgBossQueueAdapter dead-letter ordering', () => {
  beforeEach(() => {
    createQueueCalls.length = 0;
    sendCalls.length = 0;
    workCalls.length = 0;
  });

  it('creates the dead-letter queue before the main queue on publish', async () => {
    const adapter = new PgBossQueueAdapter('postgres://x');
    await adapter.publish('evt.projection.shipment', { type: 'shipment.created', payload: {} as any });

    const dlqIdx = createQueueCalls.findIndex(c => c.name === 'evt.projection.shipment.dead');
    const mainIdx = createQueueCalls.findIndex(c => c.name === 'evt.projection.shipment');
    expect(dlqIdx).toBeGreaterThanOrEqual(0);
    expect(mainIdx).toBeGreaterThan(dlqIdx);
    // The send succeeded (queue existed), proving the main queue was actually created.
    expect(sendCalls).toHaveLength(1);
  });

  it('creates the dead-letter queue before the main queue on subscribe', async () => {
    const adapter = new PgBossQueueAdapter('postgres://x');
    await adapter.subscribe('evt.projection.order', async () => {});

    const dlqIdx = createQueueCalls.findIndex(c => c.name === 'evt.projection.order.dead');
    const mainIdx = createQueueCalls.findIndex(c => c.name === 'evt.projection.order');
    expect(dlqIdx).toBeGreaterThanOrEqual(0);
    expect(mainIdx).toBeGreaterThan(dlqIdx);
    expect(workCalls).toEqual([{ name: 'evt.projection.order' }]);
  });

  it('wires the main queue to its dead-letter queue', async () => {
    const adapter = new PgBossQueueAdapter('postgres://x');
    await adapter.subscribe('evt.audit', async () => {});

    const main = createQueueCalls.find(c => c.name === 'evt.audit');
    expect(main?.opts?.deadLetter).toBe('evt.audit.dead');
  });
});
