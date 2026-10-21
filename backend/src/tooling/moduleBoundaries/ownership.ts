import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { listSourceFiles } from './checker.js';
import { classify } from './classify.js';
import { MODULES, SEALED_TABLE_GROUPS, type ModuleName } from './manifest.js';

/**
 * The table ownership check (#356). The import check can't see code that reaches another module's
 * tables through Prisma, because the Prisma client is shared, so this one reads the calls instead:
 * delegate calls on the client or a transaction, and quoted table names in raw SQL.
 */

export interface TableAccess {
  readonly file: string;
  readonly fromModule: ModuleName | null;
  readonly model: string;
  readonly toModule: ModuleName;
  readonly line: number;
}

export interface OwnershipException {
  readonly file: string;
  readonly model: string;
  readonly reason: string;
}

export interface OwnershipResult {
  readonly violations: TableAccess[];
  readonly excused: TableAccess[];
  readonly staleExceptions: OwnershipException[];
  readonly fileCount: number;
}

export const ownershipKey = (entry: { file: string; model: string }): string => `${entry.file} -> ${entry.model}`;

const DELEGATE_METHODS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert',
  'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
];
const RAW_SQL = /\$(queryRaw|executeRaw)(Unsafe)?\b/;

/** Maps each model to the module whose schema file declares it. The file is the record of ownership. */
export async function readModelOwners(schemaDir: string): Promise<Map<string, ModuleName>> {
  const owners = new Map<string, ModuleName>();
  for (const file of await readdir(schemaDir)) {
    const module = file.replace(/\.prisma$/, '') as ModuleName;
    if (!file.endsWith('.prisma') || !MODULES.includes(module)) continue;
    const source = await readFile(path.join(schemaDir, file), 'utf8');
    for (const match of source.matchAll(/^model (\w+)\s*\{/gm)) owners.set(match[1], module);
  }
  return owners;
}

const delegateName = (model: string): string => model[0].toLowerCase() + model.slice(1);

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/** Every model a source file touches, with the first line it does so on. */
export function readTableAccesses(source: string, models: readonly string[]): { model: string; line: number }[] {
  const byDelegate = new Map(models.map((model) => [delegateName(model), model]));
  const found = new Map<string, number>();
  const note = (model: string, index: number) => {
    if (!found.has(model)) found.set(model, lineOf(source, index));
  };

  const delegateCall = new RegExp(
    `\\.(${[...byDelegate.keys()].join('|')})\\s*\\.\\s*(${DELEGATE_METHODS.join('|')})\\s*\\(`,
    'g',
  );
  for (const match of source.matchAll(delegateCall)) note(byDelegate.get(match[1])!, match.index!);

  if (RAW_SQL.test(source)) {
    const quotedTable = new RegExp(`"(${models.join('|')})"`, 'g');
    for (const match of source.matchAll(quotedTable)) note(match[1], match.index!);
  }

  return [...found].map(([model, line]) => ({ model, line }));
}

const groupOf = (module: ModuleName | null): number =>
  module === null ? -1 : SEALED_TABLE_GROUPS.findIndex((group) => group.includes(module));

/** True when the access crosses into or out of a sealed group. */
export function crossesSealedGroup(fromModule: ModuleName | null, toModule: ModuleName): boolean {
  const from = groupOf(fromModule);
  const to = groupOf(toModule);
  return from !== to && (from >= 0 || to >= 0);
}

/**
 * Tests are the only files left out. Scripts and composition roots are checked, unlike in the
 * import check, because a seed script writing a WMS table through Prisma breaks at the handover
 * just as surely as a route does. A file the manifest doesn't classify counts as outside every
 * group.
 */
export async function checkOwnership(
  sourceRoot: string,
  schemaDir: string,
  exceptions: readonly OwnershipException[],
): Promise<OwnershipResult> {
  const owners = await readModelOwners(schemaDir);
  const models = [...owners.keys()];
  const files = (await listSourceFiles(sourceRoot)).filter((file) => !file.startsWith('__tests__/'));
  const excusedKeys = new Set(exceptions.map(ownershipKey));
  const usedKeys = new Set<string>();
  const violations: TableAccess[] = [];
  const excused: TableAccess[] = [];

  for (const file of files) {
    const fromModule = classify(file);
    const source = await readFile(path.join(sourceRoot, file), 'utf8');
    for (const { model, line } of readTableAccesses(source, models)) {
      const toModule = owners.get(model)!;
      if (!crossesSealedGroup(fromModule, toModule)) continue;

      const access: TableAccess = { file, fromModule, model, toModule, line };
      const key = ownershipKey(access);
      if (excusedKeys.has(key)) {
        usedKeys.add(key);
        excused.push(access);
      } else {
        violations.push(access);
      }
    }
  }

  return {
    violations,
    excused,
    staleExceptions: exceptions.filter((exception) => !usedKeys.has(ownershipKey(exception))),
    fileCount: files.length,
  };
}

export async function loadOwnershipExceptions(filePath: string): Promise<OwnershipException[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as OwnershipException[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
