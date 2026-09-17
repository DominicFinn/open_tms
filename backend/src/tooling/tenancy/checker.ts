import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import * as defaults from './policy.js';
import { loadModels, orgColumn, type Model } from './schema.js';

export type Rule =
  | 'model-without-org'
  | 'model-nullable-org'
  | 'route-without-scope'
  | 'route-not-registered'
  | 'org-fallback'
  | 'unscoped-org-lookup'
  | 'id-only-lookup'
  | 'unscoped-query'
  | 'policy-invalid';

export interface Finding {
  readonly rule: Rule;
  /** A model name or a path relative to the source root. */
  readonly target: string;
  readonly detail: string;
}

export interface BaselineEntry {
  readonly rule: Rule;
  readonly target: string;
  readonly reason: string;
}

export interface Policy {
  readonly globalModels: Readonly<Record<string, string>>;
  readonly inheritedModels: Readonly<Record<string, string>>;
  readonly scopeHelpers: readonly string[];
  readonly unscopedRouteFiles: Readonly<Record<string, string>>;
  readonly orgLookupExemptions: Readonly<Record<string, string>>;
  readonly exemptPaths: readonly RegExp[];
}

export const DEFAULT_POLICY: Policy = {
  globalModels: defaults.GLOBAL_MODELS,
  inheritedModels: defaults.INHERITED_MODELS,
  scopeHelpers: defaults.SCOPE_HELPERS,
  unscopedRouteFiles: defaults.UNSCOPED_ROUTE_FILES,
  orgLookupExemptions: defaults.ORG_LOOKUP_EXEMPTIONS,
  exemptPaths: defaults.EXEMPT_PATHS,
};

export interface CheckResult {
  readonly findings: Finding[];
  readonly baselined: Finding[];
  readonly staleBaseline: BaselineEntry[];
}

export const findingKey = (finding: { rule: string; target: string }): string =>
  `${finding.rule} ${finding.target}`;

// ─── Models ──────────────────────────────────────────────────────────────────

function resolvesToOrg(
  model: Model,
  byName: ReadonlyMap<string, Model>,
  policy: Policy,
  seen: Set<string> = new Set(),
): boolean {
  if (orgColumn(model)) return true;
  if (seen.has(model.name)) return false;
  seen.add(model.name);
  const relation = policy.inheritedModels[model.name];
  const field = relation ? model.fields.get(relation) : undefined;
  const parent = field ? byName.get(field.type) : undefined;
  if (!field || field.optional || field.list || !parent) return false;
  return resolvesToOrg(parent, byName, policy, seen);
}

function checkModel(model: Model, byName: ReadonlyMap<string, Model>, policy: Policy): Finding[] {
  const column = orgColumn(model);
  const isGlobal = model.name in policy.globalModels;
  const relation = policy.inheritedModels[model.name];

  if (column) {
    const findings: Finding[] = [];
    if (column.optional) {
      findings.push({
        rule: 'model-nullable-org',
        target: model.name,
        detail: `${column.name} is nullable, so a row can belong to no tenant`,
      });
    }
    if (isGlobal || relation) {
      findings.push({
        rule: 'policy-invalid',
        target: model.name,
        detail: `has ${column.name}, so remove it from the policy`,
      });
    }
    return findings;
  }

  if (isGlobal) return [];

  if (relation) {
    if (resolvesToOrg(model, byName, policy)) return [];
    return [
      {
        rule: 'policy-invalid',
        target: model.name,
        detail: `inherits through "${relation}", which is missing, optional, or leads to no org`,
      },
    ];
  }

  return [
    {
      rule: 'model-without-org',
      target: model.name,
      detail: 'no orgId, and not declared global or inherited in tooling/tenancy/policy.ts',
    },
  ];
}

function checkPolicyNames(models: ReadonlyMap<string, Model>, policy: Policy): Finding[] {
  return [...Object.keys(policy.globalModels), ...Object.keys(policy.inheritedModels)]
    .filter((name) => !models.has(name))
    .map((name) => ({ rule: 'policy-invalid', target: name, detail: 'no such model in the schema' }));
}

// ─── Source files ────────────────────────────────────────────────────────────

async function listSourceFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listSourceFiles(root, relative)));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) files.push(relative);
  }
  return files;
}

const isComment = (line: string): boolean => /^\s*(\/\/|\/?\*)/.test(line);

const FALLBACK_PATTERNS: readonly RegExp[] = [
  /\(\s*\w+\s+as\s+any\s*\)\s*\.\s*orgId/,
  /orgId\s*(\?\?|\|\|)\s*['"`]/,
  /['"]default-org['"]/,
  /orgId\s*:\s*['"]default['"]/,
];

// Reading the org straight off the token skips the scope hook, including its sole-org rule. Only the
// scope hooks in auth/ may do it.
const TOKEN_ORG_READ = /\b(req|request)\.user!?\??\.organizationId\b/;

function fallbackLines(file: string, source: string): number[] {
  const patterns = file.startsWith('auth/') ? FALLBACK_PATTERNS : [...FALLBACK_PATTERNS, TOKEN_ORG_READ];
  return source
    .split('\n')
    .flatMap((line, index) =>
      !isComment(line) && patterns.some((pattern) => pattern.test(line)) ? [index + 1] : [],
    );
}

/** `organization.findFirst` with no org predicate in the next few lines. Same test as #117's guard. */
function unscopedOrgLookupLines(source: string): number[] {
  const lines = source.split('\n');
  return lines.flatMap((line, index) => {
    if (!line.includes('organization.findFirst') || isComment(line)) return [];
    const window = lines.slice(index, index + 4).join('\n');
    return window.includes('where:') && /orgId/.test(window) ? [] : [index + 1];
  });
}

const ID_LOOKUP_CALL =
  /\.(\w+)\.(findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|update|delete|upsert)\(\s*\{\s*where\s*:\s*\{/g;

/** The text of the object literal whose opening brace is at `open`, or null if it never closes. */
function objectLiteralAt(source: string, open: number): string | null {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}' && --depth === 0) return source.slice(open, index + 1);
  }
  return null;
}

/**
 * A lookup keyed by id alone is allowed only where the id itself proves tenancy, such as the
 * principal named in its own verified token. The line says so with a reason, directly above it:
 *
 *   // tenancy-exempt: the user id is `sub` from the caller's own verified JWT
 */
const EXEMPT_MARKER = /\/\/\s*tenancy-exempt:\s*\S.{10,}/;

/**
 * A lookup or write on tenant data keyed by the row's id alone (#314). The multi-tenancy rule bans
 * these: an id guessed from another tenant finds the row. Tenant models must name their org in the
 * `where`; inherited models must reach it through their parent, so either way the `where` mentions
 * the org column.
 */
function idOnlyLookupLines(source: string, tenantModels: ReadonlySet<string>): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(ID_LOOKUP_CALL)) {
    const model = match[1][0].toUpperCase() + match[1].slice(1);
    if (!tenantModels.has(model)) continue;
    const where = objectLiteralAt(source, match.index! + match[0].length - 1);
    if (!where || !/^\{\s*id\b/.test(where) || /\b(orgId|organizationId)\b/.test(where)) continue;
    const all = source.split('\n');
    const line = source.slice(0, match.index).split('\n').length;
    if (isComment(all[line - 1]) || EXEMPT_MARKER.test(all[line - 2] ?? '')) continue;
    lines.push(line);
  }
  return lines;
}

const QUERY_CALL =
  /\.(\w+)\.(findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|count|aggregate|groupBy|updateMany|deleteMany|update|delete|upsert)\(\s*/g;

/** Operations that read or write every row when they are given no where at all. */
const SWEEPING_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany']);

/** The value text of the top-level `where` key in an object literal, `''` for shorthand, or null when absent. */
function topLevelWhere(args: string): string | null {
  let depth = 0;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if ('{[('.includes(char)) depth += 1;
    else if ('}])'.includes(char)) depth -= 1;
    else if (depth === 1 && /\bwhere\b/y.test(args.slice(index, index + 5)) && !/\w/.test(args[index - 1] ?? '')) {
      const rest = args.slice(index + 5).trimStart();
      if (!rest.startsWith(':')) return '';
      const value = rest.slice(1).trimStart();
      return value.startsWith('{') ? (objectLiteralAt(value, 0) ?? '') : '';
    }
  }
  return null;
}

/**
 * A query on tenant data that never names the org (#314): a list, count or bulk write with no
 * where, or with a where that filters on something other than the org, such as a parent id or a
 * reference. Lookups by the row's own id are reported by `idOnlyLookupLines` instead. A where held
 * in a variable, or built with a spread, cannot be read here and is not reported.
 */
function unscopedQueryLines(source: string, tenantModels: ReadonlySet<string>): number[] {
  const all = source.split('\n');
  const lines: number[] = [];
  for (const match of source.matchAll(QUERY_CALL)) {
    const model = match[1][0].toUpperCase() + match[1].slice(1);
    if (!tenantModels.has(model)) continue;
    const after = match.index! + match[0].length;
    const op = match[2];
    let unscoped: boolean;
    if (source[after] === ')') {
      unscoped = SWEEPING_OPS.has(op);
    } else if (source[after] === '{') {
      const args = objectLiteralAt(source, after) ?? '';
      const where = topLevelWhere(args);
      if (where === null) unscoped = SWEEPING_OPS.has(op);
      else if (where === '' || /^\{\s*id\b/.test(where) || where.includes('...')) unscoped = false;
      else unscoped = !/\b(orgId|organizationId)\b/.test(where);
    } else {
      unscoped = false;
    }
    if (!unscoped) continue;
    const line = source.slice(0, match.index).split('\n').length;
    if (isComment(all[line - 1]) || EXEMPT_MARKER.test(all[line - 2] ?? '')) continue;
    lines.push(line);
  }
  return lines;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

interface RouteRegistration {
  readonly authenticated: Set<string>;
  readonly public: Set<string>;
}

const REGISTER_BLOCK = /export\s+async\s+function\s+register\w*?(Public|Authenticated)Routes\s*\([\s\S]*?\n\}/g;

async function readRouteRegistration(sourceRoot: string, moduleFiles: string[]): Promise<RouteRegistration> {
  const registration: RouteRegistration = { authenticated: new Set(), public: new Set() };
  for (const moduleFile of moduleFiles) {
    const source = await readFile(path.join(sourceRoot, moduleFile), 'utf8');
    const importedFrom = new Map<string, string>();
    for (const match of source.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))\s+from\s+['"]\.\.\/([\w-]+)\.js['"]/g)) {
      const names = match[1] ? match[1].split(',').map((name) => name.trim().split(/\s+as\s+/).pop()!) : [match[2]];
      for (const name of names.filter(Boolean)) importedFrom.set(name, `routes/${match[3]}.ts`);
    }
    for (const block of source.matchAll(REGISTER_BLOCK)) {
      const bucket = block[1] === 'Authenticated' ? registration.authenticated : registration.public;
      for (const call of block[0].matchAll(/\.register\(\s*(\w+)/g)) {
        const file = importedFrom.get(call[1]);
        if (file) bucket.add(file);
      }
    }
  }
  return registration;
}

function checkRoute(file: string, source: string, registration: RouteRegistration, policy: Policy): Finding[] {
  if (registration.authenticated.has(file)) return [];
  if (!registration.public.has(file)) {
    return [{ rule: 'route-not-registered', target: file, detail: 'not registered by any routes/modules file' }];
  }
  if (file in policy.unscopedRouteFiles) return [];
  const callsHelper = policy.scopeHelpers.some((helper) => new RegExp(`\\b${helper}\\s*\\(`).test(source));
  if (callsHelper) return [];
  return [
    {
      rule: 'route-without-scope',
      target: file,
      detail: 'public route plugin that registers no org scope helper, so req.orgId is undefined',
    },
  ];
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function check(
  sourceRoot: string,
  schemaDir: string,
  baseline: readonly BaselineEntry[],
  policy: Policy = DEFAULT_POLICY,
): Promise<CheckResult> {
  const models = await loadModels(schemaDir);
  const byName = new Map(models.map((model) => [model.name, model]));
  const all: Finding[] = [
    ...models.flatMap((model) => checkModel(model, byName, policy)),
    ...checkPolicyNames(byName, policy),
  ];

  const files = (await listSourceFiles(sourceRoot)).filter(
    (file) => !policy.exemptPaths.some((pattern) => pattern.test(file)),
  );
  const tenantModels = new Set(
    models.filter((model) => resolvesToOrg(model, byName, policy)).map((model) => model.name),
  );
  const moduleFiles = files.filter((file) => file.startsWith('routes/modules/'));
  const registration = await readRouteRegistration(sourceRoot, moduleFiles);

  for (const file of files) {
    const source = await readFile(path.join(sourceRoot, file), 'utf8');

    // routes/modules/ registers the plugins and routes/schemas/ holds shared JSON schemas;
    // neither is a route plugin, so neither registers org scope.
    if (file.startsWith('routes/') && !file.startsWith('routes/modules/') && !file.startsWith('routes/schemas/')) {
      all.push(...checkRoute(file, source, registration, policy));
    }

    const fallbacks = fallbackLines(file, source);
    if (fallbacks.length > 0) {
      all.push({ rule: 'org-fallback', target: file, detail: `lines ${fallbacks.join(', ')}` });
    }

    const idOnly = idOnlyLookupLines(source, tenantModels);
    if (idOnly.length > 0) {
      all.push({ rule: 'id-only-lookup', target: file, detail: `lines ${idOnly.join(', ')}` });
    }

    const unscoped = unscopedQueryLines(source, tenantModels);
    if (unscoped.length > 0) {
      all.push({ rule: 'unscoped-query', target: file, detail: `lines ${unscoped.join(', ')}` });
    }

    const lookups = unscopedOrgLookupLines(source);
    if (lookups.length > 0 && !(file in policy.orgLookupExemptions)) {
      all.push({ rule: 'unscoped-org-lookup', target: file, detail: `lines ${lookups.join(', ')}` });
    }
  }

  // A policy mistake is never excusable by the baseline.
  const baselinedKeys = new Set(
    baseline.filter((entry) => entry.rule !== 'policy-invalid').map(findingKey),
  );
  const foundKeys = new Set(all.map(findingKey));

  return {
    findings: all.filter((finding) => !baselinedKeys.has(findingKey(finding))),
    baselined: all.filter((finding) => baselinedKeys.has(findingKey(finding))),
    staleBaseline: baseline.filter((entry) => !foundKeys.has(findingKey(entry))),
  };
}

export async function loadBaseline(filePath: string): Promise<BaselineEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as BaselineEntry[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
