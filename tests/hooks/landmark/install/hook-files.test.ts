import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { readNameList } from '../../../../hooks/landmark/install/read-name-list.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', 'hooks');
const ENTRIES: readonly string[] = [
  'git/subject/main.ts',
  'git/branch/main.ts',
  'git/trailer/main.ts',
];
// Read by path or run by bash, so no import leads to them; scopes.json is
// left out on purpose, an installed copy takes the repository's own.
const NAMED_FILES: readonly string[] = [
  'run.sh',
  'git/commit-msg',
  'git/reference-transaction',
  'git/forward',
  'git/forward-names.json',
  'shared/catalogs/types.json',
  'shared/catalogs/verbs.json',
  'git/trailer/trailers.json',
];
// `from '...'`, a side-effect `import '...'` and a dynamic `import('...')`.
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g;

test('lists the import closure of the three git entries and the named files', () => {
  const closure = new Set<string>();

  ENTRIES.forEach((entry) => {
    addClosure(entry, closure);
  });

  assert.deepEqual(
    readNameList(join(HOOKS, 'landmark', 'install', 'hook-files.json')).sort(),
    [...closure, ...NAMED_FILES].sort(),
  );
});

function addClosure(path: string, closure: Set<string>): void {
  if (closure.has(path)) {
    return;
  }

  closure.add(path);

  const text = readFileSync(join(HOOKS, path), 'utf8');

  [...text.matchAll(RELATIVE_IMPORT)].forEach(([, specifier]) => {
    addClosure(join(dirname(path), specifier ?? ''), closure);
  });
}
