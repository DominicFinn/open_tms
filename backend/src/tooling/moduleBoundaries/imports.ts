import { readFile } from 'node:fs/promises';
import path from 'node:path';

const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]/g;
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export interface ImportEdge {
  readonly specifier: string;
  readonly line: number;
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/** Reads every module specifier out of a source file. Regex, not the TypeScript AST: this runs on
 *  every file on every CI run, and import statements in this codebase are plain and unminified. */
export async function readImports(absolutePath: string): Promise<ImportEdge[]> {
  const source = await readFile(absolutePath, 'utf8');
  const edges: ImportEdge[] = [];
  for (const pattern of [STATIC_IMPORT, BARE_IMPORT, DYNAMIC_IMPORT]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      edges.push({ specifier: match[1], line: lineOf(source, match.index) });
    }
  }
  return edges;
}

/**
 * Resolves a relative specifier to a path relative to the source root, undoing the ESM `.js`
 * extension the codebase writes. Returns null for package imports, which the boundary doesn't
 * govern.
 */
export function resolveSpecifier(
  fromRelativePath: string,
  specifier: string,
  sourceFiles: ReadonlySet<string>
): string | null {
  if (!specifier.startsWith('.')) return null;

  const joined = path.posix.join(path.posix.dirname(fromRelativePath), specifier);
  const withoutExtension = joined.replace(/\.(js|ts)$/, '');
  const candidates = [`${withoutExtension}.ts`, `${withoutExtension}/index.ts`, joined];

  return candidates.find((candidate) => sourceFiles.has(candidate)) ?? null;
}
