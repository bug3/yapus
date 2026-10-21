import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSubjectViolations } from '../../../../hooks/shared/subject/get-subject-violations.ts';

const CATALOGS = {
  types: { path: 'c/types.json', words: ['feat'] },
  scopes: { path: 'c/scopes.json', words: ['hooks'] },
  verbs: { path: 'c/verbs.json', words: ['add'] },
};
const FORM_REFUSAL =
  'is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject';

test('passes a subject in the form with listed words', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks): add a check', CATALOGS), []);
});

test('passes a subject that is a verb alone', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks): add', CATALOGS), []);
});

test('names the catalog of an unknown type', () => {
  assert.deepEqual(getSubjectViolations('fix(hooks): add a check', CATALOGS), [
    'type "fix" is not in c/types.json; use a listed one or add it there',
  ]);
});

test('names the catalog of an unknown scope', () => {
  assert.deepEqual(getSubjectViolations('feat(lint): add a check', CATALOGS), [
    'scope "lint" is not in c/scopes.json; use a listed one or add it there',
  ]);
});

test('names the catalog of an unknown verb', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks): drop a check', CATALOGS), [
    'verb "drop" is not in c/verbs.json; use a listed one or add it there',
  ]);
});

test('names every unknown part at once', () => {
  assert.deepEqual(getSubjectViolations('fix(lint-2): drop a check', CATALOGS), [
    'type "fix" is not in c/types.json; use a listed one or add it there',
    'scope "lint-2" is not in c/scopes.json; use a listed one or add it there',
    'verb "drop" is not in c/verbs.json; use a listed one or add it there',
  ]);
});

test('refuses a capitalized verb', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks): Add a check', CATALOGS), [
    `"feat(hooks): Add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a missing scope', () => {
  assert.deepEqual(getSubjectViolations('feat: add a check', CATALOGS), [
    `"feat: add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('passes a breaking change mark before the colon', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks)!: add a check', CATALOGS), []);
});

test('refuses a breaking change mark anywhere else', () => {
  assert.deepEqual(getSubjectViolations('feat!(hooks): add a check', CATALOGS), [
    `"feat!(hooks): add a check" ${ FORM_REFUSAL }`,
  ]);
});

test('passes a subject of 72 characters', () => {
  const subject = `feat(hooks): add ${ 'x'.repeat(55) }`;

  assert.equal(subject.length, 72);
  assert.deepEqual(getSubjectViolations(subject, CATALOGS), []);
});

test('refuses a subject over 72 characters', () => {
  assert.deepEqual(getSubjectViolations(`feat(hooks): add ${ 'x'.repeat(56) }`, CATALOGS), [
    'the subject is 73 characters; keep it at most 72',
  ]);
});

test('counts the subject in characters, not UTF-16 units', () => {
  const subject = `feat(hooks): add ${ '\u{1D465}'.repeat(55) }`;

  assert.deepEqual(getSubjectViolations(subject, CATALOGS), []);
});

test('refuses a merge subject', () => {
  assert.deepEqual(getSubjectViolations("Merge branch 'x'", CATALOGS), [
    `"Merge branch 'x'" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a revert subject', () => {
  assert.deepEqual(getSubjectViolations('Revert "feat(hooks): add a check"', CATALOGS), [
    `"Revert \\"feat(hooks): add a check\\"" ${ FORM_REFUSAL }`,
  ]);
});

test('judges the subject after a fixup prefix', () => {
  assert.deepEqual(getSubjectViolations('fixup! feat(hooks): add a check', CATALOGS), []);
});

test('judges the subject after stacked autosquash prefixes', () => {
  const subject = 'fixup! squash! amend! feat(hooks): add a check';

  assert.deepEqual(getSubjectViolations(subject, CATALOGS), []);
});

test('refuses a fixup prefix before a subject out of form', () => {
  assert.deepEqual(getSubjectViolations('fixup! Fixed it', CATALOGS), [
    `"fixup! Fixed it" ${ FORM_REFUSAL }`,
  ]);
});
