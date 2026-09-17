import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, findingKey, loadBaseline, type BaselineEntry, type Finding } from './checker.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(here, '../..');
const SCHEMA_DIR = path.resolve(SOURCE_ROOT, '../prisma/schema');
const BASELINE_PATH = path.join(here, 'baseline.json');

const REASONS: Record<string, string> = {
  'model-without-org': 'Tenant data with no orgId. Add one, or declare the parent it inherits through.',
  'model-nullable-org': 'Nullable org column. Backfill and make it NOT NULL.',
  'route-without-scope': 'Public plugin with no org scope helper. Register one.',
  'route-not-registered': 'Route file no module registers. Register or delete it.',
  'org-fallback': 'Falls back to a literal or an any-cast org. Read req.orgId from the scope hook.',
  'unscoped-query': 'Tenant data listed, counted or bulk-written without the org in the where.',
  'id-only-lookup': 'Tenant data looked up or written by id alone. Put the org in the where.',
  'unscoped-org-lookup': 'Picks the first organization for every tenant (#296). Key it on the caller org.',
};

const describe = (finding: Finding): string => `  ${finding.rule.padEnd(22)} ${finding.target}  (${finding.detail})`;

async function main(): Promise<number> {
  const write = process.argv.includes('--write-baseline');
  const list = process.argv.includes('--list');
  const baseline = await loadBaseline(BASELINE_PATH);
  const result = await check(SOURCE_ROOT, SCHEMA_DIR, baseline);
  const policyErrors = result.findings.filter((finding) => finding.rule === 'policy-invalid');

  if (write) {
    if (policyErrors.length > 0) {
      console.error('Fix tooling/tenancy/policy.ts before writing a baseline:');
      for (const finding of policyErrors) console.error(describe(finding));
      return 1;
    }
    const entries: BaselineEntry[] = [...result.baselined, ...result.findings]
      .map((finding) => ({
        rule: finding.rule,
        target: finding.target,
        reason:
          baseline.find((existing) => findingKey(existing) === findingKey(finding))?.reason ??
          REASONS[finding.rule],
      }))
      .sort((a, b) => findingKey(a).localeCompare(findingKey(b)));
    await writeFile(BASELINE_PATH, `${JSON.stringify(entries, null, 2)}\n`);
    console.log(`Wrote ${entries.length} entries to ${path.relative(process.cwd(), BASELINE_PATH)}`);
    return 0;
  }

  if (list) {
    // Every finding with its lines, baselined or not, so a burn-down can see exactly what is left.
    for (const finding of [...result.baselined, ...result.findings]) console.log(describe(finding));
    return 0;
  }

  console.log(`Tenancy check: ${result.baselined.length} known gaps still in the baseline.`);

  if (result.findings.length > 0) {
    console.error(`\n${result.findings.length} tenancy problem(s):`);
    for (const finding of result.findings) console.error(describe(finding));
    console.error('\nSee .claude/rules/multi-tenancy.md. The baseline may only shrink; fix these rather than adding them.');
  }

  if (result.staleBaseline.length > 0) {
    console.error(`\n${result.staleBaseline.length} baseline entr(y/ies) now fixed. Delete them from baseline.json:`);
    for (const entry of result.staleBaseline) console.error(`  ${findingKey(entry)}`);
  }

  const failed = result.findings.length + result.staleBaseline.length;
  if (failed === 0) console.log('Tenancy OK.');
  return failed === 0 ? 0 : 1;
}

process.exitCode = await main();
