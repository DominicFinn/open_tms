import { CommandBus } from '../../commands/CommandBus';
import { ICommandHandler, Command, CommandResult } from '../../commands/types';

class TestHandler implements ICommandHandler<{ value: string }, { echo: string }> {
  readonly commandType = 'test.echo';
  async execute(command: Command<{ value: string }>): Promise<CommandResult<{ echo: string }>> {
    return { success: true, data: { echo: command.payload.value }, events: [] };
  }
}

class FailingHandler implements ICommandHandler<unknown, unknown> {
  readonly commandType = 'test.fail';
  async execute(): Promise<CommandResult<unknown>> {
    return { success: false, error: 'intentional failure', events: [] };
  }
}

describe('CommandBus', () => {
  let bus: CommandBus;

  beforeEach(() => {
    bus = new CommandBus();
  });

  it('registers and dispatches a command to its handler', async () => {
    bus.register(new TestHandler());

    const result = await bus.dispatch({
      type: 'test.echo',
      orgId: 'org-1',
      actorId: 'user-1',
      payload: { value: 'hello' },
      metadata: { correlationId: '123', source: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ echo: 'hello' });
  });

  it('throws when dispatching to unregistered command type', async () => {
    await expect(
      bus.dispatch({
        type: 'nonexistent.command',
        orgId: 'org-1',
        actorId: null,
        payload: {},
        metadata: { correlationId: '123', source: 'test' },
      })
    ).rejects.toThrow('No handler registered for command type: nonexistent.command');
  });

  it('throws when registering duplicate command type', () => {
    bus.register(new TestHandler());
    expect(() => bus.register(new TestHandler())).toThrow(
      'Handler already registered for command type: test.echo'
    );
  });

  it('returns failure result from handler', async () => {
    bus.register(new FailingHandler());

    const result = await bus.dispatch({
      type: 'test.fail',
      orgId: 'org-1',
      actorId: null,
      payload: {},
      metadata: { correlationId: '123', source: 'test' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('intentional failure');
  });

  it('can register multiple handlers for different types', () => {
    bus.register(new TestHandler());
    bus.register(new FailingHandler());
    // No error — different command types
  });
});
