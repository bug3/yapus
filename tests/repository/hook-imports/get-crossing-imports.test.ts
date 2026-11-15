import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { getCrossingImports } from './get-crossing-imports.ts';

const CROSSING_MODULE = 'hooks/claude/dashes/get-a.ts';
const SHARED_USER = 'hooks/git/push/get-b.ts';

test('names an import from the claude hooks into the git hooks', (t) => {
  const root = makeHookTree(t);

  assert.deepEqual(getCrossingImports(root, [CROSSING_MODULE]), [
    'hooks/claude/dashes/get-a.ts imports hooks/git/push/get-b.ts',
  ]);
});

test('names a side-effect import and a dynamic import across the groups', (t) => {
  const root = makeHookTree(t);
  const modulePath = 'hooks/git/push/get-d.ts';

  writeFileSync(
    join(root, modulePath),
    "import '../../claude/dashes/get-a.ts';\n\nexport const getD = () => import('../../claude/dashes/get-a.ts');\n",
  );

  assert.deepEqual(getCrossingImports(root, [modulePath]), [
    'hooks/git/push/get-d.ts imports hooks/claude/dashes/get-a.ts',
    'hooks/git/push/get-d.ts imports hooks/claude/dashes/get-a.ts',
  ]);
});

test('passes an import from a hook group into the shared modules', (t) => {
  const root = makeHookTree(t);

  assert.deepEqual(getCrossingImports(root, [SHARED_USER]), []);
});

test('names an import from the landmark hooks into the git hooks', (t) => {
  const root = makeHookTree(t);
  const modulePath = 'hooks/landmark/machine/get-e.ts';

  mkdirSync(join(root, 'hooks', 'landmark', 'machine'), { recursive: true });
  writeFileSync(join(root, modulePath), "import { getB } from '../../git/push/get-b.ts';\n");

  assert.deepEqual(getCrossingImports(root, [modulePath]), [
    'hooks/landmark/machine/get-e.ts imports hooks/git/push/get-b.ts',
  ]);
});

function makeHookTree(t: TestContext): string {
  const root = makeTempDir(t);

  mkdirSync(join(root, 'hooks', 'claude', 'dashes'), { recursive: true });
  mkdirSync(join(root, 'hooks', 'git', 'push'), { recursive: true });
  writeFileSync(
    join(root, CROSSING_MODULE),
    "import { getB } from '../../git/push/get-b.ts';\n\nexport const getA = getB;\n",
  );
  writeFileSync(
    join(root, SHARED_USER),
    "import { getC } from '../../shared/get-c.ts';\n\nexport const getB = getC;\n",
  );

  return root;
}
