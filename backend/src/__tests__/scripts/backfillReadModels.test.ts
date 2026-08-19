/**
 * Structural guard on the read-model backfill.
 *
 * The bug this prevents: a column is added to IssueReadModel and mirrored by
 * IssueProjection, but nobody updates `backfill-read-models.ts`. Nothing fails
 * — the column just silently reads as its schema default after a rebuild,
 * which for the triage columns means every issue looks like score 50, no SLA,
 * not noise. That is indistinguishable from real data.
 *
 * The backfill script calls main() at module scope, so it cannot be imported
 * and exercised here. Assert over its source instead: every scalar column on
 * IssueReadModel must be named in backfillIssues().
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';

const SCRIPT = join(__dirname, '../../scripts/backfill-read-models.ts');

/** Columns that are deliberately not copied straight across from Issue. */
const DERIVED_OR_STRUCTURAL = new Set([
  'id',        // the upsert key
  'createdAt', // only set on create, never on update
]);

function backfillIssuesSource(): string {
  const src = readFileSync(SCRIPT, 'utf8');
  const start = src.indexOf('async function backfillIssues(');
  expect(start).toBeGreaterThan(-1);
  const end = src.indexOf('\nasync function ', start + 1);
  return src.slice(start, end === -1 ? undefined : end);
}

describe('backfill-read-models: IssueReadModel coverage', () => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'IssueReadModel');

  it('finds the IssueReadModel in the Prisma schema', () => {
    expect(model).toBeDefined();
  });

  it('writes every IssueReadModel column', () => {
    const source = backfillIssuesSource();

    const columns = model!.fields
      .filter((f) => f.kind === 'scalar' && !DERIVED_OR_STRUCTURAL.has(f.name))
      .map((f) => f.name);

    const missing = columns.filter((name) => !new RegExp(`\\b${name}\\b`).test(source));

    expect(missing).toEqual([]);
  });

  /*
   * Spelled out separately from the generic check so a failure names triage as
   * the thing that broke, and so narrowing the loop above cannot quietly drop
   * triage coverage with it.
   */
  it('writes the triage scoring and SLA columns specifically', () => {
    const source = backfillIssuesSource();

    for (const field of [
      'signalScore', 'signalCount', 'isNoise', 'noiseReason',
      'slaDeadline', 'slaBreach', 'firstResponseAt',
      'timeToFirstResponseMins', 'timeToResolutionMins', 'lastActivityAt',
    ]) {
      expect(source).toContain(field);
    }
  });

  /*
   * Tenancy: the backfill must take orgId from each Issue row, not from a
   * single resolved organization. Using one org for every row would rewrite
   * every tenant's issues into the first org the script happened to find.
   */
  it('takes orgId from the issue row', () => {
    expect(backfillIssuesSource()).toContain('orgId: issue.orgId');
  });
});
