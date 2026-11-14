import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/gates/gh/get-verdict.ts';
import { makeCatalogRoot } from './make-catalog-root.ts';

const BAD_TITLE = 'gh pr create -t "Add a check"';

test('judges a gh call after time', async (t) => {
  assert.equal((await getVerdict(`time ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after command', async (t) => {
  assert.equal((await getVerdict(`command ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after then', async (t) => {
  const verdict = await getVerdict(`if true; then ${ BAD_TITLE }; fi`, makeCatalogRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after else', async (t) => {
  assert.equal(
    (await getVerdict(`if false; then true; else ${ BAD_TITLE }; fi`, makeCatalogRoot(t))).kind,
    'refuse',
  );
});

test('judges a gh call after do', async (t) => {
  const verdict = await getVerdict(`for i in 1; do ${ BAD_TITLE }; done`, makeCatalogRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('judges a gh call after env and assignments', async (t) => {
  assert.equal((await getVerdict(`env A=1 ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});

test('judges a gh call after a negation', async (t) => {
  assert.equal((await getVerdict(`! ${ BAD_TITLE }`, makeCatalogRoot(t))).kind, 'refuse');
});
