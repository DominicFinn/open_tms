import { PrismaClient } from '@prisma/client';

// pg-boss ships ESM only and the queue adapter constructs one at registration time. The
// composition root is what this test is about, not the queue.
jest.mock('pg-boss', () => ({ PgBoss: class { on() {} } }));

process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/test';

import { container } from '../../di/container.js';
import { TOKENS } from '../../di/tokens.js';
import { registerDependencies } from '../../di/registry.js';
import type { CommandBus } from '../../commands/CommandBus.js';

/** The bus keeps its handlers private; the test needs the registered types to assert on. */
const registeredCommands = (bus: CommandBus): string[] =>
  [...(bus as unknown as { handlers: Map<string, unknown> }).handlers.keys()];

describe('registerDependencies', () => {
  beforeEach(() => {
    container.clear();
    registerDependencies({} as PrismaClient);
  });

  afterAll(() => container.clear());

  it('registers a command handler from every module', () => {
    const commands = registeredCommands(container.resolve<CommandBus>(TOKENS.ICommandBus));

    // One per module, so a module dropped out of the composition root fails here.
    expect(commands).toEqual(
      expect.arrayContaining([
        'issue.create',
        'invoice.create',
        'inventory.adjust',
        'capa.create',
        'shipment.create',
        'wave.create',
      ])
    );
  });

  it('registers each command type exactly once', () => {
    const commands = registeredCommands(container.resolve<CommandBus>(TOKENS.ICommandBus));

    expect(commands).toHaveLength(new Set(commands).size);
    expect(commands.length).toBeGreaterThan(140);
  });

  it('binds the tokens the modules own', () => {
    expect(container.has(TOKENS.IOrdersRepository)).toBe(true);
    expect(container.has(TOKENS.IReceivingRepository)).toBe(true);
    expect(container.has(TOKENS.IInvoiceRepository)).toBe(true);
    expect(container.has(TOKENS.IIssueRepository)).toBe(true);
  });

  it('runs the post-construction wiring, so the skill registry is populated', () => {
    expect(container.has(TOKENS.ISkillRegistry)).toBe(true);
  });
});
