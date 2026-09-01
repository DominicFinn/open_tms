import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { classify } from './classify.js';
import { readImports, resolveSpecifier } from './imports.js';
import { ALLOWED_DEPENDENCIES, EXEMPT_PATTERNS, type ModuleName } from './manifest.js';

export interface Violation {
  readonly from: string;
  readonly fromModule: ModuleName;
  readonly to: string;
  readonly toModule: ModuleName;
  readonly line: number;
}

export interface Exception {
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

export interface CheckResult {
  readonly violations: Violation[];
  readonly excused: Violation[];
  readonly staleExceptions: Exception[];
  readonly unclassified: string[];
  readonly fileCount: number;
}

export const exceptionKey = (edge: { from: string; to: string }): string => `${edge.from} -> ${edge.to}`;

async function listSourceFiles(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(root, relative)));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(relative);
    }
  }
  return files;
}

export async function loadExceptions(filePath: string): Promise<Exception[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    return Array.isArray(parsed) ? (parsed as Exception[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function check(sourceRoot: string, exceptions: readonly Exception[]): Promise<CheckResult> {
  const files = await listSourceFiles(sourceRoot);
  const fileSet = new Set(files);
  const excusedKeys = new Set(exceptions.map(exceptionKey));
  const usedKeys = new Set<string>();

  const violations: Violation[] = [];
  const excused: Violation[] = [];
  const unclassified: string[] = [];

  for (const file of files) {
    if (EXEMPT_PATTERNS.some((pattern) => pattern.test(file))) continue;

    const fromModule = classify(file);
    if (fromModule === null) {
      unclassified.push(file);
      continue;
    }

    const allowed = ALLOWED_DEPENDENCIES[fromModule];
    for (const edge of await readImports(path.join(sourceRoot, file))) {
      const target = resolveSpecifier(file, edge.specifier, fileSet);
      if (target === null) continue;

      const toModule = classify(target);
      if (toModule === null || allowed.includes(toModule)) continue;

      const violation: Violation = { from: file, fromModule, to: target, toModule, line: edge.line };
      const key = exceptionKey(violation);
      if (excusedKeys.has(key)) {
        usedKeys.add(key);
        excused.push(violation);
      } else {
        violations.push(violation);
      }
    }
  }

  return {
    violations,
    excused,
    staleExceptions: exceptions.filter((exception) => !usedKeys.has(exceptionKey(exception))),
    unclassified,
    fileCount: files.length,
  };
}
