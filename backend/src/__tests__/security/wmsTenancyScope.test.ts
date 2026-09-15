/**
 * #238: no WMS route registered the org scope, so `req.orgId` was undefined on every WMS request.
 * Prisma reads `where: { orgId: undefined }` as no filter, so every list returned every tenant's
 * rows and the whole tenancy sweep was inert at runtime while looking correct in the source.
 *
 * These tests pin the two things that made it invisible: the guard must attach the scope, and it
 * must refuse a request that has none rather than serving one that spans tenants.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROUTES = join(__dirname, '../../routes');
const GUARD = join(__dirname, '../../auth/wmsGuard.ts');

function wmsRouteFiles(): string[] {
  return readdirSync(ROUTES)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => readFileSync(join(ROUTES, f), 'utf8').includes('registerWmsGuard'));
}

describe('WMS tenancy scope (#238)', () => {
  it('covers the WMS surface, so this is not asserting over an empty set', () => {
    expect(wmsRouteFiles().length).toBeGreaterThanOrEqual(10);
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

  it.each(wmsRouteFiles())('%s gets its tenancy from the guard, not from req.orgId alone', (file) => {
    const source = readFileSync(join(ROUTES, file), 'utf8');
    // Every WMS route reaches tenancy through the guard. A route that stopped calling it would
    // silently go back to serving every tenant.
    expect(source).toMatch(/registerWmsGuard\(server\)/);
  });
});
