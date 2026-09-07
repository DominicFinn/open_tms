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
 * Prisma mocks for the Phase 2a facility dual-write (#217, #225). Any command that creates a row
 * carrying a facilityId resolves the facility from its Location first, so its transaction mock
 * needs both models present. Defaults to an existing facility, which is the steady state after
 * the migration backfill.
 */
export function facilityMocks(existingFacilityId: string | null = 'fac-1') {
  return {
    facility: {
      findUnique: jest.fn().mockResolvedValue(existingFacilityId ? { id: existingFacilityId } : null),
      create: jest.fn().mockResolvedValue({ id: 'fac-new' }),
    },
    location: {
      findFirst: jest.fn().mockResolvedValue({
        name: 'Test DC', address1: null, address2: null,
        city: null, state: null, postalCode: null, country: null,
      }),
    },
  };
}
