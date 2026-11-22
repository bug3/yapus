import type { ExclusionMode } from './merge-settings.ts';
import { writeFile } from './write-file.ts';

// The roots the list holds once mode is applied to root, or undefined when it
// already holds them. The default sort orders by UTF-16 code units, the order
// the reader checks with <.
export function getChangedExclusions(
  roots: readonly string[],
  root: string,
  mode: ExclusionMode,
): readonly string[] | undefined {
  const isListed = roots.includes(root);

  if (isListed === (mode === 'exclude')) {
    return undefined;
  }

  return isListed ? roots.filter((listed) => listed !== root) : [...roots, root].sort();
}

// Writes roots as the list at path and returns path.
export function writeExclusions(path: string, roots: readonly string[]): string {
  return writeFile(path, `${ JSON.stringify(roots, undefined, 2) }\n`);
}
