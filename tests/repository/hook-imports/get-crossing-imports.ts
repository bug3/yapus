import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// The hook groups that import nothing from each other; both may import
// hooks/shared/.
const GROUPS: readonly string[] = ['hooks/claude/', 'hooks/git/'];
// `from '...'`, a side-effect `import '...'` and a dynamic `import('...')`.
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g;

// Every relative import of a module under root that leads from one hook group
// into another, as "<module> imports <target>", both relative to root.
export function getCrossingImports(root: string, modulePaths: readonly string[]): string[] {
  return modulePaths.flatMap((modulePath) =>
    getImportTargets(root, modulePath)
      .filter((target) => isCrossing(modulePath, target))
      .map((target) => `${ modulePath } imports ${ target }`));
}

function getImportTargets(root: string, modulePath: string): string[] {
  const moduleText = readFileSync(join(root, modulePath), 'utf8');

  return [...moduleText.matchAll(RELATIVE_IMPORT)]
    .map(([, specifier]) => join(dirname(modulePath), specifier ?? ''));
}

function isCrossing(modulePath: string, target: string): boolean {
  const moduleGroup = getGroup(modulePath);
  const targetGroup = getGroup(target);

  return moduleGroup !== undefined && targetGroup !== undefined && moduleGroup !== targetGroup;
}

function getGroup(path: string): string | undefined {
  return GROUPS.find((group) => path.startsWith(group));
}
