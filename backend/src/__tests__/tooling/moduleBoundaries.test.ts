import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classify } from '../../tooling/moduleBoundaries/classify.js';
import { check, loadExceptions } from '../../tooling/moduleBoundaries/checker.js';
import { resolveSpecifier } from '../../tooling/moduleBoundaries/imports.js';
import { ALLOWED_DEPENDENCIES, MODULES } from '../../tooling/moduleBoundaries/manifest.js';

const SOURCE_ROOT = path.resolve(__dirname, '../..');
const EXCEPTIONS_PATH = path.join(SOURCE_ROOT, 'tooling/moduleBoundaries/exceptions.json');

async function writeFixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'module-boundaries-'));
  for (const [relative, contents] of Object.entries(files)) {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(root, relative), contents);
  }
  return root;
}

describe('module manifest', () => {
  it('puts each area in the module that owns it', () => {
    expect(classify('routes/shipments.ts')).toBe('tms');
    expect(classify('routes/invoices.ts')).toBe('finance');
    expect(classify('routes/qualityCentre.ts')).toBe('quality');
    expect(classify('di/container.ts')).toBe('core');
    expect(classify('routes/roles.ts')).toBe('core');
    expect(classify('routes/triage.ts')).toBe('core');
    expect(classify('routes/locations.ts')).toBe('core');
    expect(classify('commands/trackableUnits/index.ts')).toBe('tms');
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

  it('keeps tms out of reach of the modules below it', () => {
    expect(ALLOWED_DEPENDENCIES.core).toEqual(['core']);
    expect(ALLOWED_DEPENDENCIES.finance).not.toContain('tms');
    expect(ALLOWED_DEPENDENCIES.quality).not.toContain('tms');
  });

  it('no longer knows the removed warehouse modules', () => {
    expect(MODULES).toEqual(['core', 'finance', 'quality', 'tms']);
  });
});

describe('resolveSpecifier', () => {
  const files = new Set(['routes/invoices.ts', 'services/RatingService.ts', 'di/index.ts']);

  it('undoes the ESM .js extension the codebase writes', () => {
    expect(resolveSpecifier('routes/invoices.ts', '../services/RatingService.js', files)).toBe('services/RatingService.ts');
  });

  it('resolves a directory import to its index', () => {
    expect(resolveSpecifier('routes/invoices.ts', '../di/index.js', files)).toBe('di/index.ts');
  });

  it('ignores package imports, which the boundary does not govern', () => {
    expect(resolveSpecifier('routes/invoices.ts', '@prisma/client', files)).toBeNull();
  });
});

describe('check', () => {
  it('fails a finance file that imports tms', async () => {
    const root = await writeFixture({
      'routes/invoices.ts': "import { RatingService } from '../services/RatingService.js';\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, []);

    expect(result.violations).toEqual([
      expect.objectContaining({ from: 'routes/invoices.ts', fromModule: 'finance', to: 'services/RatingService.ts', toModule: 'tms', line: 1 }),
    ]);
  });

  it('catches a dynamic import too', async () => {
    const root = await writeFixture({
      'routes/invoices.ts': "export const load = () => import('../services/RatingService.js');\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, []);

    expect(result.violations).toHaveLength(1);
  });

  it('excuses a leak that is on the burn-down list', async () => {
    const root = await writeFixture({
      'routes/invoices.ts': "import { RatingService } from '../services/RatingService.js';\n",
      'services/RatingService.ts': 'export class RatingService {}\n',
    });

    const result = await check(root, [{ from: 'routes/invoices.ts', to: 'services/RatingService.ts', reason: 'known' }]);

    expect(result.violations).toHaveLength(0);
    expect(result.excused).toHaveLength(1);
  });

  it('reports an exception whose leak has been fixed, so the list cannot rot', async () => {
    const root = await writeFixture({ 'routes/invoices.ts': 'export const invoices = [];\n' });

    const result = await check(root, [{ from: 'routes/invoices.ts', to: 'services/RatingService.ts', reason: 'already fixed' }]);

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

describe('the backend as it stands', () => {
  it('has no boundary violations beyond the seeded burn-down list', async () => {
    const result = await check(SOURCE_ROOT, await loadExceptions(EXCEPTIONS_PATH));

    expect(result.unclassified).toEqual([]);
    expect(result.violations).toEqual([]);
    expect(result.staleExceptions).toEqual([]);
  });
});
