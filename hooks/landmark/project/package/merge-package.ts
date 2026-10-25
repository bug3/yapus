import { type Changes, type Section } from './get-section.ts';
import { parsePackage } from './parse-package.ts';
import { removeLegacyKeys } from './remove-legacy-keys.ts';
import { setOwnedKeys } from './set-owned-keys.ts';
import { setTestScript } from './set-test-script.ts';

export interface PackageMerge {
  readonly text: string;
  readonly set: readonly string[];
  readonly removed: readonly string[];
}

// The package.json text the project installer writes, and the dotted keys it
// set and removed. Without a text, an empty private package is the start.
export function mergePackage(
  text: string | undefined,
  mode: 'install' | 'upgrade',
): PackageMerge {
  const changes: Changes = { set: [], removed: [] };
  const root: Section = { object: parsePackage(text ?? '{"private": true}'), path: '', changes };

  setOwnedKeys(root);

  if (mode === 'install') {
    setTestScript(root);
    removeLegacyKeys(root);
  }

  return {
    text: `${ JSON.stringify(root.object, undefined, 2) }\n`,
    set: changes.set,
    removed: changes.removed,
  };
}
