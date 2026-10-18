import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getStandardsPathsViolations } from './get-standards-paths-violations.ts';

interface Standard {
  readonly name: string;
  readonly text: string;
}

const PATHS_HEAD = '---\npaths:\n  - "**/*.ts"\n---\n\n';
const PRINCIPLES: Standard = { name: 'PRINCIPLES.md', text: '# P\n' };

test('finds nothing when the always-loaded standard has no head and the rest have one', (t) => {
  const root = makeStandards(t, [PRINCIPLES, { name: 'CODE.md', text: `${ PATHS_HEAD }# C\n` }]);

  assert.deepEqual(getStandardsPathsViolations(root), []);
});

test('names a path-loaded standard with no paths head', (t) => {
  const root = makeStandards(t, [PRINCIPLES, { name: 'CODE.md', text: '# C\n' }]);

  assert.deepEqual(getStandardsPathsViolations(root), ['standards/CODE.md: no paths frontmatter']);
});

test('names the always-loaded standard when it has a paths head', (t) => {
  const root = makeStandards(t, [{ name: 'PRINCIPLES.md', text: `${ PATHS_HEAD }# P\n` }]);

  assert.deepEqual(getStandardsPathsViolations(root), [
    'standards/PRINCIPLES.md: has paths frontmatter but loads always',
  ]);
});

test('treats a paths head with no entry as no head', (t) => {
  const root = makeStandards(t, [{ name: 'CODE.md', text: '---\npaths:\n---\n# C\n' }]);

  assert.deepEqual(getStandardsPathsViolations(root), ['standards/CODE.md: no paths frontmatter']);
});

test('ignores markdown outside standards', (t) => {
  const root = makeStandards(t, []);

  writeFileSync(join(root, 'README.md'), '# R\n');

  assert.deepEqual(getStandardsPathsViolations(root), []);
});

function makeStandards(t: TestContext, standards: readonly Standard[]): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'standards'));

  for (const { name, text } of standards) {
    writeFileSync(join(root, 'standards', name), text);
  }

  return root;
}
