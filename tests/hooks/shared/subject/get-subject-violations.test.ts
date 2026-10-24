import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSubjectViolations } from '../../../../hooks/shared/subject/get-subject-violations.ts';

const CATALOGS = {
  types: { path: 'c/types.json', words: ['feat'] },
  scopes: { path: 'c/scopes.json', words: ['hooks'] },
  verbs: { path: 'c/verbs.json', words: ['add'] },
};
const PULL_REQUEST_TITLE = { allowAutosquash: false, allowGenerated: false };
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
    'type "fix" is not in c/types.json; use a listed one',
  ]);
});

test('names the catalog of an unknown scope', () => {
  assert.deepEqual(getSubjectViolations('feat(lint): add a check', CATALOGS), [
    'scope "lint" is not in c/scopes.json; use a listed one',
  ]);
});

test('names the catalog of an unknown verb', () => {
  assert.deepEqual(getSubjectViolations('feat(hooks): drop a check', CATALOGS), [
    'verb "drop" is not in c/verbs.json; use a listed one',
  ]);
});

test('names every unknown part at once', () => {
  assert.deepEqual(getSubjectViolations('fix(lint-2): drop a check', CATALOGS), [
    'type "fix" is not in c/types.json; use a listed one',
    'scope "lint-2" is not in c/scopes.json; use a listed one',
    'verb "drop" is not in c/verbs.json; use a listed one',
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

test('refuses a merge subject when generated subjects are not allowed', () => {
  const subject = "Merge branch 'x'";

  assert.deepEqual(getSubjectViolations(subject, CATALOGS, PULL_REQUEST_TITLE), [
    `"Merge branch 'x'" ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a revert subject when generated subjects are not allowed', () => {
  const subject = 'Revert "feat(hooks): add a check"';

  assert.deepEqual(getSubjectViolations(subject, CATALOGS, PULL_REQUEST_TITLE), [
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

test('refuses a fixup prefix when autosquash is not allowed', () => {
  const subject = 'fixup! feat(hooks): add a check';

  assert.deepEqual(getSubjectViolations(subject, CATALOGS, PULL_REQUEST_TITLE), [
    `${ JSON.stringify(subject) } ${ FORM_REFUSAL }`,
  ]);
});

test('refuses a fixup prefix before a subject out of form', () => {
  assert.deepEqual(getSubjectViolations('fixup! Fixed it', CATALOGS), [
    `"fixup! Fixed it" ${ FORM_REFUSAL }`,
  ]);
});

test('passes the subjects git writes for a merge', () => {
  for (const subject of [
    "Merge branch 'x'",
    "Merge branch 'x' into main",
    "Merge branches 'x' and 'y'",
    "Merge remote-tracking branch 'origin/x'",
    "Merge tag 'v1'",
    "Merge commit 'abc'",
    'Merge pull request #12 from owner/branch',
  ]) {
    assert.deepEqual(getSubjectViolations(subject, CATALOGS), [], subject);
  }
});

test('passes the subject git writes for a revert', () => {
  assert.deepEqual(getSubjectViolations('Revert "feat(hooks): add a check"', CATALOGS), []);
});

test('refuses a merge or revert subject that git would not write', () => {
  for (const subject of [
    'Merge the calibration fix',
    'Merge branch of nouns',
    'Merge pull request fix',
    'Revert "x" because y',
  ]) {
    assert.deepEqual(getSubjectViolations(subject, CATALOGS), [
      `${ JSON.stringify(subject) } ${ FORM_REFUSAL }`,
    ], subject);
  }
});

test('does not limit the length of a generated subject', () => {
  assert.deepEqual(getSubjectViolations(`Revert "${ 'x'.repeat(70) }"`, CATALOGS), []);
});
