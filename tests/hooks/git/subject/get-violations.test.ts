import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getViolations } from '../../../../hooks/git/subject/get-violations.ts';

const CATALOGS = {
  types: { path: 'c/types.json', words: ['feat'] },
  scopes: { path: 'c/scopes.json', words: ['hooks'] },
  verbs: { path: 'c/verbs.json', words: ['add'] },
};
const FORM_REFUSAL =
  'is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject';

test('passes a subject in the form with listed words', () => {
  assert.deepEqual(getViolations('feat(hooks): add a check', CATALOGS), []);
});

test('passes a subject that is a verb alone', () => {
  assert.deepEqual(getViolations('feat(hooks): add', CATALOGS), []);
});

test('names the catalog of an unknown type', () => {
  assert.deepEqual(getViolations('fix(hooks): add a check', CATALOGS), [
    'type "fix" is not in c/types.json; use a listed one or add it there',
  ]);
});

test('names the catalog of an unknown scope', () => {
  assert.deepEqual(getViolations('feat(lint): add a check', CATALOGS), [
    'scope "lint" is not in c/scopes.json; use a listed one or add it there',
  ]);
});

test('names the catalog of an unknown verb', () => {
  assert.deepEqual(getViolations('feat(hooks): drop a check', CATALOGS), [
    'verb "drop" is not in c/verbs.json; use a listed one or add it there',
  ]);
});

test('names every unknown part at once', () => {
  assert.deepEqual(getViolations('fix(lint-2): drop a check', CATALOGS), [
    'type "fix" is not in c/types.json; use a listed one or add it there',
    'scope "lint-2" is not in c/scopes.json; use a listed one or add it there',
    'verb "drop" is not in c/verbs.json; use a listed one or add it there',
  ]);
});

test('refuses a capitalized verb', () => {
  assert.deepEqual(getViolations('feat(hooks): Add a check', CATALOGS), [
    `"feat(hooks): Add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a missing scope', () => {
  assert.deepEqual(getViolations('feat: add a check', CATALOGS), [
    `"feat: add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a breaking change mark', () => {
  assert.deepEqual(getViolations('feat(hooks)!: add a check', CATALOGS), [
    `"feat(hooks)!: add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a merge subject', () => {
  assert.deepEqual(getViolations("Merge branch 'x'", CATALOGS), [
    `"Merge branch 'x'" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a revert subject', () => {
  assert.deepEqual(getViolations('Revert "feat(hooks): add a check"', CATALOGS), [
    `"Revert \\"feat(hooks): add a check\\"" ${ FORM_REFUSAL }`,
  ]);
});

test('judges the subject after a fixup prefix', () => {
  assert.deepEqual(getViolations('fixup! feat(hooks): add a check', CATALOGS), []);
});

test('judges the subject after stacked autosquash prefixes', () => {
  assert.deepEqual(getViolations('fixup! squash! amend! feat(hooks): add a check', CATALOGS), []);
});

test('refuses a fixup prefix before a subject out of form', () => {
  assert.deepEqual(getViolations('fixup! Fixed it', CATALOGS), [
    `"fixup! Fixed it" ${ FORM_REFUSAL }`,
  ]);
});
