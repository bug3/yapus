import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/gh/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const BAD_TITLE = 'gh pr create -t "Add a check"';

test('judges a gh call after time', (t) => {
  assert.equal(getVerdict(`time ${ BAD_TITLE }`, makeTempDir(t)).kind, 'refuse');
});

test('judges a gh call after command', (t) => {
  assert.equal(getVerdict(`command ${ BAD_TITLE }`, makeTempDir(t)).kind, 'refuse');
});

test('judges a gh call after then', (t) => {
  assert.equal(getVerdict(`if true; then ${ BAD_TITLE }; fi`, makeTempDir(t)).kind, 'refuse');
});

test('judges a gh call after else', (t) => {
  assert.equal(
    getVerdict(`if false; then true; else ${ BAD_TITLE }; fi`, makeTempDir(t)).kind,
    'refuse',
  );
});

test('judges a gh call after do', (t) => {
  assert.equal(getVerdict(`for i in 1; do ${ BAD_TITLE }; done`, makeTempDir(t)).kind, 'refuse');
});

test('judges a gh call after env and assignments', (t) => {
  assert.equal(getVerdict(`env A=1 ${ BAD_TITLE }`, makeTempDir(t)).kind, 'refuse');
});

test('judges a gh call after a negation', (t) => {
  assert.equal(getVerdict(`! ${ BAD_TITLE }`, makeTempDir(t)).kind, 'refuse');
});
