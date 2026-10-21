import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCreationViolation } from '../../../../hooks/git/branch/get-creation-violation.ts';
import type { BranchFacts } from '../../../../hooks/git/branch/make-branch-facts.ts';
import type { Catalog } from '../../../../hooks/shared/read-catalog.ts';

const TYPES: Catalog = { path: 'types.json', words: ['feat', 'fix'] };
const NEW_REPO: BranchFacts = {
  hasRef: () => false,
  getDefaultBranches: () => ['refs/heads/main'],
  getRemoteRefs: () => [],
};
const BAD_REFUSAL =
  'branch `bad` is not `<type>/<slug>` (type from types.json, slug of lowercase letters, '
  + 'digits and hyphens, at most 50); name it so';

test('refuses a new branch not named <type>/<slug>', () => {
  assert.equal(getCreationViolation('refs/heads/bad', NEW_REPO, TYPES), BAD_REFUSAL);
});

test('lets a new branch named <type>/<slug> through', () => {
  assert.equal(getCreationViolation('refs/heads/feat/ok', NEW_REPO, TYPES), undefined);
});

test('lets a forced update of an existing branch through', () => {
  const facts: BranchFacts = { ...NEW_REPO, hasRef: () => true };

  assert.equal(getCreationViolation('refs/heads/bad', facts, TYPES), undefined);
});

test('lets a default branch through', () => {
  assert.equal(getCreationViolation('refs/heads/main', NEW_REPO, TYPES), undefined);
});

test('lets a branch a remote has through', () => {
  const facts: BranchFacts = { ...NEW_REPO, getRemoteRefs: () => ['refs/remotes/origin/bad'] };

  assert.equal(getCreationViolation('refs/heads/bad', facts, TYPES), undefined);
});

test('refuses a branch a remote has only under a longer name', () => {
  const facts: BranchFacts = { ...NEW_REPO, getRemoteRefs: () => ['refs/remotes/origin/x/bad'] };

  assert.equal(getCreationViolation('refs/heads/bad', facts, TYPES), BAD_REFUSAL);
});

test('refuses when git cannot say whether the ref exists', () => {
  const facts: BranchFacts = { ...NEW_REPO, hasRef: () => ({ violation: 'cannot read' }) };

  assert.equal(getCreationViolation('refs/heads/bad', facts, TYPES), 'cannot read');
});
