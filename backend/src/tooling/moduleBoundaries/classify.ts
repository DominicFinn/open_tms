import { PATH_RULES, type ModuleName } from './manifest.js';

/** Returns the module a source file belongs to, or null when the manifest doesn't cover it. */
export function classify(relativePath: string): ModuleName | null {
  const normalised = relativePath.split('\\').join('/');
  for (const rule of PATH_RULES) {
    if (rule.pattern.test(normalised)) return rule.module;
  }
  return null;
}
