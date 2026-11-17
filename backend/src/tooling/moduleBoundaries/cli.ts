import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, exceptionKey, loadExceptions, type Exception, type Violation } from './checker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(here, '../..');
const EXCEPTIONS_PATH = path.join(here, 'exceptions.json');

const describe = (violation: Violation): string =>
  `  ${violation.from}:${violation.line}  ${violation.fromModule} -> ${violation.toModule}  (${violation.to})`;

const byKey = <T>(key: (entry: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

async function writeBaseline(exceptions: Exception[]): Promise<void> {
  const imports = await check(SOURCE_ROOT, exceptions);
  const baseline: Exception[] = [...imports.excused, ...imports.violations]
    .map((violation) => ({
      from: violation.from,
      to: violation.to,
      reason:
        exceptions.find((existing) => exceptionKey(existing) === exceptionKey(violation))?.reason ??
        `Pre-existing ${violation.fromModule} -> ${violation.toModule} leak, to burn down`,
    }))
    .filter((entry, index, all) => all.findIndex((other) => exceptionKey(other) === exceptionKey(entry)) === index)
    .sort(byKey(exceptionKey));
  await writeFile(EXCEPTIONS_PATH, `${JSON.stringify(baseline, null, 2)}\n`);

  console.log(`Wrote ${baseline.length} import exceptions`);
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
    console.error('\nSee .claude/rules/module-boundaries.md. Cross a boundary with an event or a DI-resolved interface, not an import.');
  }

  if (result.staleExceptions.length > 0) {
    console.error(`\n${result.staleExceptions.length} exception(s) no longer needed. Delete them from exceptions.json:`);
    for (const exception of result.staleExceptions) console.error(`  ${exceptionKey(exception)}`);
  }

  return result.unclassified.length + result.violations.length + result.staleExceptions.length;
}

async function main(): Promise<number> {
  const exceptions = await loadExceptions(EXCEPTIONS_PATH);

  if (process.argv.includes('--write-exceptions')) {
    await writeBaseline(exceptions);
    return 0;
  }

  const failed = reportImports(await check(SOURCE_ROOT, exceptions));

  if (failed === 0) console.log('Module boundaries OK.');
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
