import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { getVerdict, type Verdict } from '../../../../../hooks/claude/gates/gh/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeCatalogRoot } from './make-catalog-root.ts';

const BAD_TITLE = 'gh pr create -t "Add a check"';

test('judges a gh call after time', async (t) => {
  assert.equal((await judge(t, `time ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after command', async (t) => {
  assert.equal((await judge(t, `command ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after then', async (t) => {
  const verdict = await judge(t, `if true; then ${ BAD_TITLE }; fi`, makeCatalogRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after else', async (t) => {
  assert.equal(
    (await judge(t, `if false; then true; else ${ BAD_TITLE }; fi`, makeCatalogRoot(t))).kind,
    'refuse',
  );
});

test('judges a gh call after do', async (t) => {
  const verdict = await judge(t, `for i in 1; do ${ BAD_TITLE }; done`, makeCatalogRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after env and assignments', async (t) => {
  assert.equal((await judge(t, `env A=1 ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after a negation', async (t) => {
  assert.equal((await judge(t, `! ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

// The verdict with a home that holds no exclusion list.
async function judge(t: TestContext, command: string, cwd: string): Promise<Verdict> {
  return getVerdict(command, cwd, { home: makeTempDir(t), env: process.env });
}
