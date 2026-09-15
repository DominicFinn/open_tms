import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Structural guard for #117.
 *
 * `prisma.organization.findFirst()` with no tenant predicate returns whichever Organization row
 * comes back first, for every caller. In a single-org deployment that is right by luck; with a
 * second tenant it reads and writes into the wrong one. Routes must take the tenant from the
 * request — `req.orgId`, populated by a scope hook — and any read of the Organization row itself
 * must be keyed on it.
 *
 * This test fails on a new occurrence rather than trusting reviewers to spot one, because the
 * original 61 accumulated exactly that way.
 */

const ROUTES_DIR = join(__dirname, '..', '..', 'routes');

/** Files where an unkeyed lookup is correct, with the reason it is correct. */
const ALLOWED = new Map<string, string>([
  [
    'seed.ts',
    'Seeding has no caller tenant and targets the sole development organisation. The endpoints ' +
      'are 403 in production.',
  ],
  [
    'theme.ts',
    'Two unauthenticated branding reads served before login. Resolution is via resolvePublicOrg, ' +
      'which refuses to guess once a second organisation exists.',
  ],
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** A call is scoped when a tenant predicate appears within the call expression. */
function unscopedCalls(source: string): number[] {
  const lines = source.split('\n');
  const hits: number[] = [];
  lines.forEach((line, i) => {
    if (!line.includes('organization.findFirst')) return;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const window = lines.slice(i, i + 4).join('\n');
    if (window.includes('where:') && /orgId/.test(window)) return;
    hits.push(i + 1);
  });
  return hits;
}

describe('routes resolve the tenant from the request (#117)', () => {
  const files = walk(ROUTES_DIR);

  it('finds route files to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no unscoped organization.findFirst outside the documented exceptions', () => {
    const offenders = files
      .map((file) => ({ file, lines: unscopedCalls(readFileSync(file, 'utf8')) }))
      .filter(({ file, lines }) => lines.length > 0 && !ALLOWED.has(file.split('/').pop()!));

    expect(
      offenders.map(({ file, lines }) => `${file.split('/routes/')[1]}:${lines.join(',')}`)
    ).toEqual([]);
  });

  it('keeps every exception documented with a reason', () => {
    for (const [name, reason] of ALLOWED) {
      expect(reason.length).toBeGreaterThan(40);
      expect(files.some((f) => f.endsWith(`/${name}`))).toBe(true);
    }
  });

  it('does not let theme.ts serve branding writes to unauthenticated callers', () => {
    // The seven mutations live in themeAdmin.ts, inside the authenticated scope. theme.ts holds
    // only the two reads a logged-out browser needs.
    const theme = readFileSync(join(ROUTES_DIR, 'theme.ts'), 'utf8');
    expect(theme).not.toMatch(/server\.(put|post|delete)\(/);
  });
});
