/**
 * Test utilities for CQRS command and projection testing.
 *
 * Provides:
 * - mockEventBus(): captures published events for assertion
 * - createTestCommand(): builds a Command with sensible defaults
 * - createTestEvent(): builds a DomainEvent with sensible defaults
 */

import { randomUUID } from 'crypto';
import { DomainEvent } from '../../events/DomainEvent';
import { PgBossEventBus } from '../../events/PgBossEventBus';
import { Command } from '../../commands/types';

/**
 * Creates a mock PgBossEventBus that captures persist/fanOut calls
 * without touching the database or queue.
 */
export function mockEventBus() {
  const persisted: DomainEvent[] = [];
  const fannedOut: DomainEvent[] = [];

  const bus = {
    persist: jest.fn(async (event: DomainEvent) => {
      persisted.push(event);
    }),
    fanOut: jest.fn(async (event: DomainEvent) => {
      fannedOut.push(event);
    }),
    publish: jest.fn(async (event: DomainEvent) => {
      persisted.push(event);
      fannedOut.push(event);
    }),
    publishBatch: jest.fn(async (events: DomainEvent[]) => {
      for (const e of events) {
        persisted.push(e);
        fannedOut.push(e);
      }
    }),
    subscribe: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  } as unknown as PgBossEventBus;

  return {
    bus,
    /** Events that were persisted to DomainEventLog (inside transaction) */
    persisted,
    /** Events that were fanned out to handler queues (after commit) */
    fannedOut,
    /** Reset captured events */
    reset() {
      persisted.length = 0;
      fannedOut.length = 0;
    },
  };
}

/**
 * Creates a test Command with sensible defaults.
 * Override any field via the partial parameter.
 */
export function createTestCommand<T>(
  type: string,
  payload: T,
  overrides?: Partial<Command<T>>
): Command<T> {
  return {
    type,
    orgId: overrides?.orgId ?? 'test-org',
    actorId: overrides?.actorId ?? 'test-user',
    payload,
    metadata: {
      correlationId: randomUUID(),
      source: 'test',
      ...overrides?.metadata,
    },
    ...overrides,
  };
}

/**
 * Creates a test DomainEvent with sensible defaults.
 * Used for projection handler testing.
 */
export function createTestEvent<T>(
  type: string,
  entityType: string,
  entityId: string,
  payload: T,
  overrides?: Partial<DomainEvent<T>>
): DomainEvent<T> {
  const id = randomUUID();
  return {
    id,
    type,
    timestamp: new Date().toISOString(),
    orgId: overrides?.orgId ?? 'test-org',
    actorId: overrides?.actorId ?? 'test-user',
    entityType,
    entityId,
    payload,
    metadata: {
      correlationId: id,
      source: 'test',
      schemaVersion: 1,
      ...overrides?.metadata,
    },
    ...overrides,
  };
}

/**
 * Creates a minimal mock Prisma transaction client.
 * Each model method returns a jest.fn() that you can configure per test.
 */
export function mockPrismaTransaction() {
  const createModelProxy = () => {
    return new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return jest.fn();
        }
        return undefined;
      },
    });
  };

  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop === 'string' && prop !== 'then') {
        return createModelProxy();
      }
      return undefined;
    },
  });
}
