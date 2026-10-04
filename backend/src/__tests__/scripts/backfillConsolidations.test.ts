/**
 * The consolidation backfill reuses the projection's own refresh, so the two can't drift. These
 * checks guard what remains: the step is registered, and each row is rebuilt under its own orgId
 * rather than one org resolved for the whole run (#329).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { refreshConsolidationReadModel } from '../../events/projections/ConsolidationProjection';

const SCRIPT = readFileSync(join(__dirname, '../../scripts/backfill-read-models.ts'), 'utf8');

describe('backfill-read-models: consolidations', () => {
  it('registers a consolidations step', () => {
    expect(SCRIPT).toMatch(/name: 'consolidations'.*backfillConsolidations\(prisma\)/);
  });

  it('refreshes each consolidation under its own org', () => {
    const start = SCRIPT.indexOf('async function backfillConsolidations(');
    const body = SCRIPT.slice(start, SCRIPT.indexOf('\nasync function ', start + 1));
    expect(body).toContain('refreshConsolidationReadModel(prisma, c.orgId, c.id)');
  });

  it('builds the row for the org the consolidation belongs to', async () => {
    const prisma = {
      consolidation: { findFirst: jest.fn().mockResolvedValue({
        id: 'con-1', orgId: 'org-b', reference: 'CON-1', status: 'draft', archived: false,
        createdAt: new Date(), updatedAt: new Date(), carrier: null, stops: [], shipments: [],
      }) },
      consolidationReadModel: { upsert: jest.fn() },
    } as any;

    await refreshConsolidationReadModel(prisma, 'org-b', 'con-1');

    expect(prisma.consolidation.findFirst.mock.calls[0][0].where).toEqual({ id: 'con-1', orgId: 'org-b' });
    expect(prisma.consolidationReadModel.upsert.mock.calls[0][0].create.orgId).toBe('org-b');
  });
});
