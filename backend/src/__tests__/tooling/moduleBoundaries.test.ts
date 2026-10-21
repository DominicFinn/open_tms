import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classify } from '../../tooling/moduleBoundaries/classify.js';
import { check, loadExceptions } from '../../tooling/moduleBoundaries/checker.js';
import { resolveSpecifier } from '../../tooling/moduleBoundaries/imports.js';
import { ALLOWED_DEPENDENCIES, MODULES } from '../../tooling/moduleBoundaries/manifest.js';
import {
  checkOwnership,
  crossesSealedGroup,
  loadOwnershipExceptions,
  readTableAccesses,
} from '../../tooling/moduleBoundaries/ownership.js';

const SOURCE_ROOT = path.resolve(__dirname, '../..');
const EXCEPTIONS_PATH = path.join(SOURCE_ROOT, 'tooling/moduleBoundaries/exceptions.json');
const OWNERSHIP_EXCEPTIONS_PATH = path.join(SOURCE_ROOT, 'tooling/moduleBoundaries/ownership-exceptions.json');
const SCHEMA_DIR = path.resolve(SOURCE_ROOT, '../prisma/schema');

async function writeFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'module-boundaries-'));
  for (const [relative, contents] of Object.entries(files)) {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(root, relative), contents);
  }
  return root;
}

describe('module manifest', () => {
  it('puts each area in the module ADR 0002 assigns it to', () => {
    expect(classify('routes/shipments.ts')).toBe('tms');
    expect(classify('routes/waves.ts')).toBe('wms');
    expect(classify('commands/warehouse/ReleaseWaveCommand.ts')).toBe('wms');
    expect(classify('routes/invoices.ts')).toBe('finance');
    expect(classify('routes/inventory.ts')).toBe('inventory');
    expect(classify('routes/qualityCentre.ts')).toBe('quality');
    expect(classify('di/container.ts')).toBe('core');
    expect(classify('routes/roles.ts')).toBe('core');
    expect(classify('routes/triage.ts')).toBe('core');
  });

  it('keeps the two conflated areas out of wms until Phase 2 moves them', () => {
    expect(classify('routes/locations.ts')).toBe('core');
    expect(classify('commands/trackableUnits/index.ts')).toBe('tms');
  });

  it('reads the dock app as tms, since it prepares shipments and touches no WMS table', () => {
    expect(classify('routes/warehouse.ts')).toBe('tms');
    expect(classify('services/WarehouseService.ts')).toBe('tms');
    expect(classify('routes/warehouseZones.ts')).toBe('wms');
    expect(classify('services/warehouse/WarehouseOperationsDashboardService.ts')).toBe('wms');
  });

  it('reads a returns authorisation as tms without catching lookalike names', () => {
    expect(classify('commands/rma/CreateRmaCommand.ts')).toBe('tms');
    expect(classify('routes/customerRmaApi.ts')).toBe('tms');
    expect(classify('services/templates/rateConfirmationTemplate.ts')).toBe('tms');
  });

  it('gives every module a dependency list that only names real modules', () => {
    for (const module of MODULES) {
      expect(ALLOWED_DEPENDENCIES[module]).toContain(module);
      for (const dependency of ALLOWED_DEPENDENCIES[module]) {
        expect(MODULES).toContain(dependency);
      }
    }
  });

  it('never lets tms and wms see each other', () => {
    expect(ALLOWED_DEPENDENCIES.tms).not.toContain('wms');
    expect(ALLOWED_DEPENDENCIES.wms).not.toContain('tms');
  });
});

describe('resolveSpecifier', () => {
  const files = new Set(['routes/waves.ts', 'services/RatingService.ts', 'di/index.ts']);

  it('undoes the ESM .js extension the codebase writes', () => {
    expect(resolveSpecifier('routes/waves.ts', '../services/RatingService.js', files)).toBe('services/RatingService.ts');
  });

  it('resolves a directory import to its index', () => {
    expect(resolveSpecifier('routes/waves.ts', '../di/index.js', files)).toBe('di/index.ts');
  });

  it('ignores package imports, which the boundary does not govern', () => {
    expect(resolveSpecifier('routes/waves.ts', '@prisma/client', files)).toBeNull();
  });
});

describe('check', () => {
  it('fails a wms file that imports tms', async () => {
    const root = await writeFixture({
      'routes/waves.ts': "import { RatingService } from '../services/RatingService.js';\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, []);

    expect(result.violations).toEqual([
      expect.objectContaining({ from: 'routes/waves.ts', fromModule: 'wms', to: 'services/RatingService.ts', toModule: 'tms', line: 1 }),
    ]);
  });

  it('catches a dynamic import too', async () => {
    const root = await writeFixture({
      'routes/waves.ts': "export const load = () => import('../services/RatingService.js');\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, []);

    expect(result.violations).toHaveLength(1);
  });

  it('excuses a leak that is on the burn-down list', async () => {
    const root = await writeFixture({
      'routes/waves.ts': "import { RatingService } from '../services/RatingService.js';\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, [{ from: 'routes/waves.ts', to: 'services/RatingService.ts', reason: 'known' }]);

    expect(result.violations).toHaveLength(0);
    expect(result.excused).toHaveLength(1);
  });

  it('reports an exception whose leak has been fixed, so the list cannot rot', async () => {
    const root = await writeFixture({ 'routes/waves.ts': 'export const waves = [];\n' });

    const result = await check(root, [{ from: 'routes/waves.ts', to: 'services/RatingService.ts', reason: 'already fixed' }]);

    expect(result.staleExceptions).toHaveLength(1);
  });

  it('reports a file the manifest does not cover', async () => {
    const root = await writeFixture({ 'somewhereNew/thing.ts': 'export const thing = 1;\n' });

    const result = await check(root, []);

    expect(result.unclassified).toEqual(['somewhereNew/thing.ts']);
  });

  it('allows tms to import core', async () => {
    const root = await writeFixture({
      'routes/shipments.ts': "import { container } from '../di/container.js';\n",
      'di/container.ts': 'export const container = {};\n',
    });

    const result = await check(root, []);

    expect(result.violations).toHaveLength(0);
  });
});

describe('readTableAccesses', () => {
  const models = ['Order', 'OrderLineItem', 'PickLine', 'Facility'];

  it('finds delegate calls on the client and on a transaction', () => {
    const source = 'await tx.pickLine.update({});\nawait prisma.facility\n  .findMany({});\n';

    expect(readTableAccesses(source, models)).toEqual([
      { model: 'PickLine', line: 1 },
      { model: 'Facility', line: 2 },
    ]);
  });

  it('tells a model from a longer one that starts with its name', () => {
    expect(readTableAccesses('tx.orderLineItem.findUnique({})', models)).toEqual([{ model: 'OrderLineItem', line: 1 }]);
  });

  it('ignores a property that is not followed by a Prisma call', () => {
    expect(readTableAccesses('const id = order.facility.id; payload.order.update;', models)).toEqual([]);
  });

  it('reads quoted table names, but only in a file that runs raw SQL', () => {
    const raw = 'await prisma.$queryRaw`SELECT * FROM "Facility" WHERE "orgId" = ${orgId}`;';

    expect(readTableAccesses(raw, models)).toEqual([{ model: 'Facility', line: 1 }]);
    expect(readTableAccesses('const label = "Facility";', models)).toEqual([]);
  });
});

describe('crossesSealedGroup', () => {
  it('stops anything reaching into the FinnWMS tables, and FinnWMS reaching out', () => {
    expect(crossesSealedGroup('tms', 'wms')).toBe(true);
    expect(crossesSealedGroup('core', 'inventory')).toBe(true);
    expect(crossesSealedGroup('wms', 'tms')).toBe(true);
    expect(crossesSealedGroup('inventory', 'core')).toBe(true);
    expect(crossesSealedGroup(null, 'wms')).toBe(true);
  });

  it('lets wms and inventory share tables, since they move into one service together', () => {
    expect(crossesSealedGroup('wms', 'inventory')).toBe(false);
    expect(crossesSealedGroup('inventory', 'wms')).toBe(false);
  });

  it('leaves modules that are not being ported alone', () => {
    expect(crossesSealedGroup('tms', 'core')).toBe(false);
    expect(crossesSealedGroup('finance', 'tms')).toBe(false);
  });
});

describe('checkOwnership', () => {
  async function fixture(files: Record<string, string>): Promise<{ root: string; schema: string }> {
    const root = await writeFixture(files);
    const schema = await writeFixture({
      'wms.prisma': 'model Facility {\n  id String @id\n}\n',
      'inventory.prisma': 'model InventoryRecord {\n  id String @id\n}\n',
      'tms.prisma': 'model Order {\n  id String @id\n}\n',
      'core.prisma': 'model Customer {\n  id String @id\n}\n',
      'config.prisma': 'generator client {\n  provider = "prisma-client-js"\n}\n',
    });
    return { root, schema };
  }

  it('fails a tms file reading a wms table and a wms file reading a tms table', async () => {
    const { root, schema } = await fixture({
      'routes/shipments.ts': 'await prisma.facility.findMany({});\n',
      'routes/waves.ts': 'await tx.order.findFirst({});\n',
    });

    const result = await checkOwnership(root, schema, []);

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: 'routes/shipments.ts', fromModule: 'tms', model: 'Facility', toModule: 'wms' }),
        expect.objectContaining({ file: 'routes/waves.ts', fromModule: 'wms', model: 'Order', toModule: 'tms' }),
      ]),
    );
    expect(result.violations).toHaveLength(2);
  });

  it('allows wms to touch inventory, and tms to touch core', async () => {
    const { root, schema } = await fixture({
      'routes/waves.ts': 'await tx.inventoryRecord.update({});\n',
      'routes/shipments.ts': 'await prisma.customer.findMany({});\n',
    });

    const result = await checkOwnership(root, schema, []);

    expect(result.violations).toEqual([]);
  });

  it('checks scripts, but not tests', async () => {
    const { root, schema } = await fixture({
      'scripts/seed.ts': 'await prisma.facility.deleteMany({});\n',
      '__tests__/waves.test.ts': 'await prisma.order.findMany({});\n',
    });

    const result = await checkOwnership(root, schema, []);

    expect(result.violations).toEqual([expect.objectContaining({ file: 'scripts/seed.ts', fromModule: null })]);
  });

  it('excuses a listed access and reports one that has gone', async () => {
    const { root, schema } = await fixture({ 'routes/shipments.ts': 'await prisma.facility.findMany({});\n' });

    const result = await checkOwnership(root, schema, [
      { file: 'routes/shipments.ts', model: 'Facility', reason: 'known' },
      { file: 'routes/orders.ts', model: 'Facility', reason: 'already fixed' },
    ]);

    expect(result.violations).toEqual([]);
    expect(result.excused).toHaveLength(1);
    expect(result.staleExceptions).toEqual([expect.objectContaining({ file: 'routes/orders.ts' })]);
  });
});

describe('the backend as it stands', () => {
  it('has no boundary violations beyond the seeded burn-down list', async () => {
    const result = await check(SOURCE_ROOT, await loadExceptions(EXCEPTIONS_PATH));

    expect(result.unclassified).toEqual([]);
    expect(result.violations).toEqual([]);
    expect(result.staleExceptions).toEqual([]);
  });

  it('touches no FinnWMS table across the group boundary beyond the burn-down list', async () => {
    const result = await checkOwnership(SOURCE_ROOT, SCHEMA_DIR, await loadOwnershipExceptions(OWNERSHIP_EXCEPTIONS_PATH));

    expect(result.violations).toEqual([]);
    expect(result.staleExceptions).toEqual([]);
  });
});
