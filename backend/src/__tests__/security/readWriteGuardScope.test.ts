/**
 * #238: a set of guarded routes once never registered the org scope, so `req.orgId` was undefined
 * on every request to them. Prisma reads `where: { orgId: undefined }` as no filter, so every list
 * returned every tenant's rows while the source looked correct.
 *
 * These tests pin the two things that made it invisible: the guard must attach the scope, and it
 * must refuse a request that has none rather than serving one that spans tenants.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROUTES = join(__dirname, '../../routes');
const GUARD = join(__dirname, '../../auth/readWriteGuard.ts');

function guardedRouteFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => readFileSync(join(ROUTES, f), 'utf8').includes('registerReadWriteGuard'));
}

describe('read/write guard tenancy scope (#238)', () => {
  it('covers the guarded routes, so this is not asserting over an empty set', () => {
    expect(guardedRouteFiles()).toEqual(expect.arrayContaining(['rma.ts', 'cutoffMonitor.ts']));
  });

  it('the guard attaches the org scope', () => {
    const guard = readFileSync(GUARD, 'utf8');
    expect(guard).toMatch(/registerOrgScope\(server\)/);
  });

  it('the guard fails closed when no tenant context resolves', () => {
    const guard = readFileSync(GUARD, 'utf8');
    expect(guard).toMatch(/requireOrgScope/);
  });

  it('attaches the scope before requiring it, or the check always fires', () => {
    const guard = readFileSync(GUARD, 'utf8');
    expect(guard.indexOf('registerOrgScope(server)')).toBeLessThan(guard.indexOf("'preHandler', requireOrgScope"));
  });

  it.each(guardedRouteFiles())('%s names the permission family it is guarded by', (file) => {
    const source = readFileSync(join(ROUTES, file), 'utf8');
    // A guarded route reaches tenancy and its permission check through the guard. A route that
    // stopped calling it would silently go back to "is authenticated".
    expect(source).toMatch(/registerReadWriteGuard\(server, '[a-z_]+'\)/);
  });
});
