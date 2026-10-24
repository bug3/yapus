import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/gh/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const BAD_TITLE = 'gh pr create -t "Add a check"';

test('judges a gh call after time', async (t) => {
  assert.equal((await getVerdict(`time ${ BAD_TITLE }`, makeTempDir(t))).kind, 'refuse');
});

test('judges a gh call after command', async (t) => {
  assert.equal((await getVerdict(`command ${ BAD_TITLE }`, makeTempDir(t))).kind, 'refuse');
});

test('judges a gh call after then', async (t) => {
  const verdict = await getVerdict(`if true; then ${ BAD_TITLE }; fi`, makeTempDir(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after else', async (t) => {
  assert.equal(
    (await getVerdict(`if false; then true; else ${ BAD_TITLE }; fi`, makeTempDir(t))).kind,
    'refuse',
  );
});

test('judges a gh call after do', async (t) => {
  const verdict = await getVerdict(`for i in 1; do ${ BAD_TITLE }; done`, makeTempDir(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after env and assignments', async (t) => {
  assert.equal((await getVerdict(`env A=1 ${ BAD_TITLE }`, makeTempDir(t))).kind, 'refuse');
});

test('judges a gh call after a negation', async (t) => {
  assert.equal((await getVerdict(`! ${ BAD_TITLE }`, makeTempDir(t))).kind, 'refuse');
});
