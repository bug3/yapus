import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { getRulesLinkProblems } from './get-rules-link-problems.ts';

const WITH_PATHS = '---\npaths:\n  - "**/*.sh"\n---\n\n# A\n';
const WITHOUT_PATHS = '# B\n';

test('finds nothing when each standard with paths is linked', (t) => {
  const root = makeTree(t);

  symlinkSync(join('..', '..', 'standards', 'A.md'), join(root, '.claude', 'rules', 'a.md'));

  assert.deepEqual(getRulesLinkProblems(root), []);
});

test('names a standard with paths that has no link', (t) => {
  assert.deepEqual(getRulesLinkProblems(makeTree(t)), [
    '.claude/rules/a.md: missing; link it to ../../standards/A.md',
  ]);
});

test('names a link that is a copy, not a symlink', (t) => {
  const root = makeTree(t);

  writeFileSync(join(root, '.claude', 'rules', 'a.md'), WITH_PATHS);

  assert.deepEqual(getRulesLinkProblems(root), [
    '.claude/rules/a.md: is not a symlink to ../../standards/A.md',
  ]);
});

test('names a link to another file', (t) => {
  const root = makeTree(t);

  symlinkSync(join('..', '..', 'standards', 'B.md'), join(root, '.claude', 'rules', 'a.md'));

  assert.deepEqual(getRulesLinkProblems(root), [
    '.claude/rules/a.md: is not a symlink to ../../standards/A.md',
  ]);
});

// A root with standards A (with paths) and B (without) and an empty rules dir.
function makeTree(t: TestContext): string {
  const root = makeTempDir(t);

  mkdirSync(join(root, 'standards'));
  mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
  writeFileSync(join(root, 'standards', 'A.md'), WITH_PATHS);
  writeFileSync(join(root, 'standards', 'B.md'), WITHOUT_PATHS);

  return root;
}
