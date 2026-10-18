import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getRuleFormViolations } from './get-rule-form-violations.ts';

const HEAD = '---\npaths:\n  - "**/*.ts"\n---\n\n';

test('finds nothing in a standard of a title and one-sentence headings', (t) => {
  const root = makeStandard(t, `${ HEAD }# A\n\n## A-1. Do x.\n\n## A-2. Do \`y\`, then z.\n`);

  assert.deepEqual(getRuleFormViolations(root), []);
});

test('names a line under a heading', (t) => {
  const root = makeStandard(t, '# A\n\n## A-1. Do x.\n\nBecause y.\n');

  assert.deepEqual(getRuleFormViolations(root), ['standards/A.md:5: not a rule heading']);
});

test('names a heading of two sentences', (t) => {
  const root = makeStandard(t, '# A\n\n## A-1. Do x. Then y.\n');

  assert.deepEqual(getRuleFormViolations(root), ['standards/A.md:3: not one sentence']);
});

test('names a heading that ends without a period', (t) => {
  const root = makeStandard(t, '# A\n\n## A-1. Do x\n');

  assert.deepEqual(getRuleFormViolations(root), ['standards/A.md:3: not one sentence']);
});

test('names a standard that does not open with a title', (t) => {
  const root = makeStandard(t, `${ HEAD }## A-1. Do x.\n`);

  assert.deepEqual(getRuleFormViolations(root), ['standards/A.md:6: not a title']);
});

function makeStandard(t: TestContext, text: string): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'standards'));
  writeFileSync(join(root, 'standards', 'A.md'), text);

  return root;
}
