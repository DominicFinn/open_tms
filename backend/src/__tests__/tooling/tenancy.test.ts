import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  check,
  DEFAULT_POLICY,
  loadBaseline,
  type BaselineEntry,
  type Policy,
} from '../../tooling/tenancy/checker.js';
import { parseModels } from '../../tooling/tenancy/schema.js';

const SOURCE_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_DIR = path.resolve(SOURCE_ROOT, '../prisma/schema');
const BASELINE_PATH = path.join(SOURCE_ROOT, 'tooling/tenancy/baseline.json');

const SCHEMA = `
model Organization {
  id String @id
}

model Shipment {
  id    String @id
  orgId String
}

model ShipmentStop {
  id         String   @id
  shipmentId String
  shipment   Shipment @relation(fields: [shipmentId], references: [id])
}

model StopNote {
  id     String       @id
  stopId String
  stop   ShipmentStop @relation(fields: [stopId], references: [id])
}

model Loose {
  id String @id
}
`;

const MODULE = `
import type { FastifyInstance } from 'fastify';
import { publicThings } from '../publicThings.js';
import { helperThings } from '../helperThings.js';
import { shipmentRoutes } from '../shipments.js';

export async function registerTmsPublicRoutes(server: FastifyInstance): Promise<void> {
  await server.register(publicThings);
  await server.register(helperThings);
}

export async function registerTmsAuthenticatedRoutes(app: FastifyInstance): Promise<void> {
  await app.register(shipmentRoutes);
}
`;

const POLICY: Policy = {
  ...DEFAULT_POLICY,
  globalModels: { Organization: 'The tenant.' },
  inheritedModels: { ShipmentStop: 'shipment', StopNote: 'stop' },
  unscopedRouteFiles: {},
  orgLookupExemptions: {},
  idLookupExemptions: {},
};

async function fixture(
  files: Record<string, string>,
  schema = SCHEMA,
): Promise<{ sourceRoot: string; schemaDir: string }> {
  const root = await mkdtemp(path.join(tmpdir(), 'tenancy-'));
  const all: Record<string, string> = {
    'prisma/schema/tms.prisma': schema,
    'src/routes/modules/tms.ts': MODULE,
    'src/routes/publicThings.ts': 'export async function publicThings() {}\n',
    'src/routes/helperThings.ts': 'export async function helperThings(s) { await registerOrgScope(s); }\n',
    'src/routes/shipments.ts': 'export async function shipmentRoutes() {}\n',
    ...files,
  };
  for (const [relative, contents] of Object.entries(all)) {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(root, relative), contents);
  }
  return { sourceRoot: path.join(root, 'src'), schemaDir: path.join(root, 'prisma/schema') };
}

const keys = (findings: { rule: string; target: string }[]): string[] =>
  findings.map((finding) => `${finding.rule} ${finding.target}`).sort();

describe('schema parsing', () => {
  it('reads optional and list fields', () => {
    const [model] = parseModels(
      'model A {\n  id String @id\n  orgId String?\n  tags Tag[]\n  // note\n  @@index([orgId])\n}\n',
    );
    expect(model.fields.get('orgId')).toMatchObject({ type: 'String', optional: true, list: false });
    expect(model.fields.get('tags')).toMatchObject({ type: 'Tag', list: true });
    expect(model.fields.has('@@index([orgId])')).toBe(false);
  });
});

describe('tenancy check: models', () => {
  it('flags a model with no org and no declared parent, and accepts the rest', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(keys(result.findings)).toEqual(['model-without-org Loose', 'route-without-scope routes/publicThings.ts']);
  });

  it('accepts a child that inherits through another inherited child', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(keys(result.findings)).not.toContain('policy-invalid StopNote');
  });

  it('rejects inheritance through an optional relation', async () => {
    const schema = SCHEMA.replace(
      'stop   ShipmentStop @relation',
      'stop   ShipmentStop? @relation',
    );
    const { sourceRoot, schemaDir } = await fixture({}, schema);
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(keys(result.findings)).toContain('policy-invalid StopNote');
  });

  it('flags a nullable org column', async () => {
    const schema = SCHEMA.replace('orgId String\n', 'orgId String?\n');
    const { sourceRoot, schemaDir } = await fixture({}, schema);
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(keys(result.findings)).toContain('model-nullable-org Shipment');
  });

  it('flags a policy entry for a model that has its own org or does not exist', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const policy: Policy = { ...POLICY, globalModels: { ...POLICY.globalModels, Shipment: 'x', Ghost: 'y' } };
    const result = await check(sourceRoot, schemaDir, [], policy);
    expect(keys(result.findings)).toEqual(
      expect.arrayContaining(['policy-invalid Shipment', 'policy-invalid Ghost']),
    );
  });
});

describe('tenancy check: routes', () => {
  it('treats the authenticated block as scoped and requires a helper on public plugins', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    const routeFindings = result.findings.filter((finding) => finding.target.startsWith('routes/'));
    expect(keys(routeFindings)).toEqual(['route-without-scope routes/publicThings.ts']);
  });

  it('accepts a documented unscoped public plugin', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const policy: Policy = { ...POLICY, unscopedRouteFiles: { 'routes/publicThings.ts': 'Serves nothing.' } };
    const result = await check(sourceRoot, schemaDir, [], policy);
    expect(keys(result.findings)).toEqual(['model-without-org Loose']);
  });

  it('flags a route file that no module registers', async () => {
    const { sourceRoot, schemaDir } = await fixture({ 'src/routes/orphan.ts': 'export {}\n' });
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(keys(result.findings)).toContain('route-not-registered routes/orphan.ts');
  });
});

describe('tenancy check: source patterns', () => {
  it('flags org fallbacks and ignores them in comments', async () => {
    const { sourceRoot, schemaDir } = await fixture({
      'src/services/a.ts': "const orgId = (req as any).orgId || 'default-org';\n",
      'src/services/b.ts': "publish({ orgId: 'default' });\n",
      'src/services/c.ts': "const x = { orgId: req.orgId ?? '' };\n",
      'src/services/d.ts': "// never write (req as any).orgId || 'default-org'\n",
    });
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    const fallbacks = result.findings.filter((finding) => finding.rule === 'org-fallback');
    expect(keys(fallbacks)).toEqual([
      'org-fallback services/a.ts',
      'org-fallback services/b.ts',
      'org-fallback services/c.ts',
    ]);
  });

  it('flags an organization lookup with no org predicate, and not a keyed one', async () => {
    const { sourceRoot, schemaDir } = await fixture({
      'src/services/first.ts': 'const org = await prisma.organization.findFirst();\n',
      'src/services/keyed.ts':
        'const org = await prisma.organization.findFirst({\n  where: { id: orgId },\n});\n',
    });
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    const lookups = result.findings.filter((finding) => finding.rule === 'unscoped-org-lookup');
    expect(keys(lookups)).toEqual(['unscoped-org-lookup services/first.ts']);
    expect(lookups[0].detail).toBe('lines 1');
  });

  it('ignores tests, scripts and the tooling itself', async () => {
    const { sourceRoot, schemaDir } = await fixture({
      'src/__tests__/x.test.ts': "const orgId = 'default-org';\n",
      'src/scripts/seed.ts': 'await prisma.organization.findFirst();\n',
    });
    const result = await check(sourceRoot, schemaDir, [], POLICY);
    expect(result.findings.some((finding) => /__tests__|scripts/.test(finding.target))).toBe(false);
  });
});

describe('tenancy check: id-only lookups', () => {
  const idOnly = async (source: string, policy: Policy = POLICY): Promise<string[]> => {
    const { sourceRoot, schemaDir } = await fixture({ 'src/services/lookups.ts': source });
    const result = await check(sourceRoot, schemaDir, [], policy);
    return result.findings.filter((finding) => finding.rule === 'id-only-lookup').map((finding) => finding.detail);
  };

  it('flags reads and writes on tenant models keyed by id alone', async () => {
    const source = [
      'await prisma.shipment.findUnique({ where: { id } });',
      'await tx.shipment.update({',
      '  where: { id: input.id, archived: false },',
      '  data: {},',
      '});',
      'await prisma.shipmentStop.delete({ where: { id: stopId } });',
    ].join('\n');
    expect(await idOnly(source)).toEqual(['lines 1, 2, 6']);
  });

  it('accepts a where that names the org, directly or through the parent', async () => {
    const source = [
      'await prisma.shipment.findUnique({ where: { id, orgId } });',
      'await prisma.shipmentStop.findFirst({ where: { id, shipment: { orgId } } });',
      'await prisma.shipment.findFirst({ where: { orgId, id } });',
    ].join('\n');
    expect(await idOnly(source)).toEqual([]);
  });

  it('ignores global models, variable wheres and comments', async () => {
    const source = [
      'await prisma.organization.findUnique({ where: { id } });',
      'await prisma.shipment.findUnique({ where });',
      '// await prisma.shipment.findUnique({ where: { id } });',
    ].join('\n');
    expect(await idOnly(source)).toEqual([]);
  });

  it('skips files on the exemption list', async () => {
    const policy: Policy = { ...POLICY, idLookupExemptions: { 'services/lookups.ts': 'The id is the proof.' } };
    expect(await idOnly('await prisma.shipment.findUnique({ where: { id } });', policy)).toEqual([]);
  });
});

describe('tenancy check: baseline', () => {
  const baseline: BaselineEntry[] = [
    { rule: 'model-without-org', target: 'Loose', reason: 'To burn down.' },
    { rule: 'route-without-scope', target: 'routes/publicThings.ts', reason: 'To burn down.' },
  ];

  it('excuses a known gap', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const result = await check(sourceRoot, schemaDir, baseline, POLICY);
    expect(result.findings).toEqual([]);
    expect(result.baselined).toHaveLength(2);
  });

  it('reports a baseline entry whose gap is fixed, so the list only shrinks', async () => {
    const { sourceRoot, schemaDir } = await fixture({}, SCHEMA.replace('model Loose {\n  id String @id\n}', ''));
    const result = await check(sourceRoot, schemaDir, baseline, POLICY);
    expect(keys(result.staleBaseline)).toEqual(['model-without-org Loose']);
  });

  it('never lets the baseline excuse a policy mistake', async () => {
    const { sourceRoot, schemaDir } = await fixture({});
    const policy: Policy = { ...POLICY, globalModels: { ...POLICY.globalModels, Ghost: 'y' } };
    const result = await check(
      sourceRoot,
      schemaDir,
      [...baseline, { rule: 'policy-invalid', target: 'Ghost', reason: 'no' }],
      policy,
    );
    expect(keys(result.findings)).toEqual(['policy-invalid Ghost']);
  });
});

describe('tenancy check against the real tree', () => {
  it('finds nothing beyond the baseline, and no baseline entry is stale', async () => {
    const result = await check(SOURCE_ROOT, SCHEMA_DIR, await loadBaseline(BASELINE_PATH));
    expect(keys(result.findings)).toEqual([]);
    expect(keys(result.staleBaseline)).toEqual([]);
  });

  it('gives every baseline entry a reason', async () => {
    for (const entry of await loadBaseline(BASELINE_PATH)) {
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });
});
