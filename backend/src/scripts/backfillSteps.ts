/**
 * Step selection for the read model backfill.
 *
 * Separate from the script itself so it can be tested without importing a module whose side
 * effect is to run a backfill.
 */

export interface BackfillStep {
  readonly name: string;
  readonly label: string;
  readonly run: () => Promise<number>;
}

/**
 * Selects the steps to run from `--only=a,b`. A release that adds one read model should rebuild
 * that one, not every read model in the system: a full rebuild is wasted work on every deploy
 * and grows with the data.
 *
 * An unknown name throws rather than matching nothing, because a backfill that silently does
 * nothing looks identical to a backfill that worked.
 */
export function selectSteps(argv: readonly string[], steps: readonly BackfillStep[]): BackfillStep[] {
  const flag = argv.find((arg) => arg.startsWith('--only='));
  if (!flag) return [...steps];

  const requested = flag
    .slice('--only='.length)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  const unknown = requested.filter((name) => !steps.some((step) => step.name === name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown backfill step(s): ${unknown.join(', ')}. Available: ${steps.map((s) => s.name).join(', ')}`
    );
  }

  return steps.filter((step) => requested.includes(step.name));
}
