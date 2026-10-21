import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getBranchNameViolation } from '../../../hooks/shared/get-branch-name-violation.ts';

const TYPES = { path: 'c/types.json', words: ['feat', 'fix'] };

function refusalOf(name: string): string {
  return `branch \`${ name }\` is not \`<type>/<slug>\` (type from c/types.json, slug of `
    + 'lowercase letters, digits and hyphens, at most 50); name it so';
}

test('passes a listed type and a slug', () => {
  assert.equal(getBranchNameViolation('feat/git-gate', TYPES), undefined);
  assert.equal(getBranchNameViolation('fix/b2', TYPES), undefined);
});

test('passes a slug of 50 characters', () => {
  assert.equal(getBranchNameViolation(`feat/${ 'a'.repeat(50) }`, TYPES), undefined);
});

test('refuses a slug over 50 characters', () => {
  const name = `feat/${ 'a'.repeat(51) }`;

  assert.equal(getBranchNameViolation(name, TYPES), refusalOf(name));
});

test('refuses a type outside the catalog', () => {
  assert.equal(getBranchNameViolation('docs/x', TYPES), refusalOf('docs/x'));
});

test('refuses a name without a type', () => {
  assert.equal(getBranchNameViolation('git-gate', TYPES), refusalOf('git-gate'));
});

test('refuses a slug with capitals, underscores, dots or a slash', () => {
  for (const name of ['feat/Gate', 'feat/git_gate', 'feat/v1.2', 'feat/a/b']) {
    assert.equal(getBranchNameViolation(name, TYPES), refusalOf(name));
  }
});

test('refuses an empty slug and stray hyphens', () => {
  for (const name of ['feat/', 'feat/-a', 'feat/a-', 'feat/a--b']) {
    assert.equal(getBranchNameViolation(name, TYPES), refusalOf(name));
  }
});
