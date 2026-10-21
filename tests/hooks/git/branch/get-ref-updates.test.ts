import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canCreateBranch, getRefUpdates } from '../../../../hooks/git/branch/get-ref-updates.ts';

const ZERO = '0000000000000000000000000000000000000000';
const SHA = '1111111111111111111111111111111111111111';

test('reads one update per ref line', () => {
  assert.deepEqual(getRefUpdates(`${ ZERO } ${ SHA } refs/heads/bad\n`), {
    updates: [{ oldValue: ZERO, newValue: SHA, ref: 'refs/heads/bad' }],
  });
});

test('reads a symbolic ref update', () => {
  assert.deepEqual(getRefUpdates('ref:refs/heads/main ref:refs/heads/bad HEAD\n'), {
    updates: [{ oldValue: 'ref:refs/heads/main', newValue: 'ref:refs/heads/bad', ref: 'HEAD' }],
  });
});

test('refuses a ref line that is not three fields', () => {
  assert.deepEqual(getRefUpdates(`${ ZERO } ${ SHA }\n`), {
    violation:
      'ref line 1 is not "<old-value> <new-value> <ref-name>"; the branch is refused, retry it',
  });
});

test('counts a zero old value on a refs/heads/ ref as a possible creation', () => {
  assert.equal(canCreateBranch({ oldValue: ZERO, newValue: SHA, ref: 'refs/heads/bad' }), true);
});

test('does not count an update with a known old value as a creation', () => {
  assert.equal(canCreateBranch({ oldValue: SHA, newValue: SHA, ref: 'refs/heads/bad' }), false);
});

test('does not count a ref outside refs/heads/ as a creation', () => {
  assert.equal(canCreateBranch({ oldValue: ZERO, newValue: SHA, ref: 'refs/tags/v1' }), false);
});
