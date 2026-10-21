import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, exceptionKey, loadExceptions, type Exception, type Violation } from './checker.js';
import {
  checkOwnership,
  loadOwnershipExceptions,
  ownershipKey,
  type OwnershipException,
  type TableAccess,
} from './ownership.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(here, '../..');
const SCHEMA_DIR = path.resolve(SOURCE_ROOT, '../prisma/schema');
const EXCEPTIONS_PATH = path.join(here, 'exceptions.json');
const OWNERSHIP_EXCEPTIONS_PATH = path.join(here, 'ownership-exceptions.json');

const describe = (violation: Violation): string =>
  `  ${violation.from}:${violation.line}  ${violation.fromModule} -> ${violation.toModule}  (${violation.to})`;

const describeAccess = (access: TableAccess): string =>
  `  ${access.file}:${access.line}  ${access.fromModule ?? 'unclassified'} touches ${access.model} (${access.toModule})`;

const byKey = <T>(key: (entry: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

async function writeBaselines(exceptions: Exception[], ownershipExceptions: OwnershipException[]): Promise<void> {
  const imports = await check(SOURCE_ROOT, exceptions);
  const importBaseline: Exception[] = [...imports.excused, ...imports.violations]
    .map((violation) => ({
      from: violation.from,
      to: violation.to,
      reason:
        exceptions.find((existing) => exceptionKey(existing) === exceptionKey(violation))?.reason ??
        `Pre-existing ${violation.fromModule} -> ${violation.toModule} leak, to burn down`,
    }))
    .filter((entry, index, all) => all.findIndex((other) => exceptionKey(other) === exceptionKey(entry)) === index)
    .sort(byKey(exceptionKey));
  await writeFile(EXCEPTIONS_PATH, `${JSON.stringify(importBaseline, null, 2)}\n`);

  const tables = await checkOwnership(SOURCE_ROOT, SCHEMA_DIR, ownershipExceptions);
  const ownershipBaseline: OwnershipException[] = [...tables.excused, ...tables.violations]
    .map((access) => ({
      file: access.file,
      model: access.model,
      reason:
        ownershipExceptions.find((existing) => ownershipKey(existing) === ownershipKey(access))?.reason ??
        `Pre-existing ${access.fromModule ?? 'unclassified'} access to a ${access.toModule} table, to burn down`,
    }))
    .sort(byKey(ownershipKey));
  await writeFile(OWNERSHIP_EXCEPTIONS_PATH, `${JSON.stringify(ownershipBaseline, null, 2)}\n`);

  console.log(`Wrote ${importBaseline.length} import and ${ownershipBaseline.length} table exceptions`);
}

function reportImports(result: Awaited<ReturnType<typeof check>>): number {
  console.log(`Checked ${result.fileCount} files, ${result.excused.length} known leaks still excused.`);

  if (result.unclassified.length > 0) {
    console.error(`\n${result.unclassified.length} file(s) not covered by the module manifest:`);
    for (const file of result.unclassified) console.error(`  ${file}`);
    console.error('\nAdd a rule to tooling/moduleBoundaries/manifest.ts for each.');
  }

  if (result.violations.length > 0) {
    console.error(`\n${result.violations.length} module boundary violation(s):`);
    for (const violation of result.violations) console.error(describe(violation));
    console.error('\nSee .claude/rules/module-boundaries.md. Cross a boundary with an event or a DI port, not an import.');
  }

  if (result.staleExceptions.length > 0) {
    console.error(`\n${result.staleExceptions.length} exception(s) no longer needed. Delete them from exceptions.json:`);
    for (const exception of result.staleExceptions) console.error(`  ${exceptionKey(exception)}`);
  }

  return result.unclassified.length + result.violations.length + result.staleExceptions.length;
}

function reportOwnership(result: Awaited<ReturnType<typeof checkOwnership>>): number {
  console.log(`Checked table ownership, ${result.excused.length} known cross-group accesses still excused.`);

  if (result.violations.length > 0) {
    console.error(`\n${result.violations.length} table ownership violation(s):`);
    for (const access of result.violations) console.error(describeAccess(access));
    console.error(
      '\nThese tables are leaving Prisma (ADR 0005). Reach them through a port or an event, never through Prisma.',
    );
  }

  if (result.staleExceptions.length > 0) {
    console.error(
      `\n${result.staleExceptions.length} table exception(s) no longer needed. Delete them from ownership-exceptions.json:`,
    );
    for (const exception of result.staleExceptions) console.error(`  ${ownershipKey(exception)}`);
  }

  return result.violations.length + result.staleExceptions.length;
}

async function main(): Promise<number> {
  const exceptions = await loadExceptions(EXCEPTIONS_PATH);
  const ownershipExceptions = await loadOwnershipExceptions(OWNERSHIP_EXCEPTIONS_PATH);

  if (process.argv.includes('--write-exceptions')) {
    await writeBaselines(exceptions, ownershipExceptions);
    return 0;
  }

  const failed =
    reportImports(await check(SOURCE_ROOT, exceptions)) +
    reportOwnership(await checkOwnership(SOURCE_ROOT, SCHEMA_DIR, ownershipExceptions));

  if (failed === 0) console.log('Module boundaries OK.');
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
