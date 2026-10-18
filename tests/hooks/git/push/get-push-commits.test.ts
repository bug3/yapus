import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPushCommits } from '../../../../hooks/git/push/get-push-commits.ts';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ZERO_SHA = '0000000000000000000000000000000000000000';
const SHA_256 = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

test('lists the local sha of a pushed ref', () => {
  assert.deepEqual(getPushCommits(`refs/heads/main ${ SHA_A } refs/heads/main ${ SHA_B }\n`), {
    commits: [SHA_A],
  });
});

test('lists a sha that two refs point to once', () => {
  const stdinText = [
    `refs/heads/main ${ SHA_A } refs/heads/main ${ SHA_B }`,
    `refs/tags/v1 ${ SHA_A } refs/tags/v1 ${ ZERO_SHA }`,
    '',
  ].join('\n');

  assert.deepEqual(getPushCommits(stdinText), { commits: [SHA_A] });
});

test('skips a deleted ref', () => {
  const stdinText = [
    `(delete) ${ ZERO_SHA } refs/heads/old ${ SHA_B }`,
    `refs/heads/main ${ SHA_A } refs/heads/main ${ SHA_B }`,
    '',
  ].join('\n');

  assert.deepEqual(getPushCommits(stdinText), { commits: [SHA_A] });
});

test('lists a SHA-256 sha', () => {
  assert.deepEqual(getPushCommits(`refs/heads/main ${ SHA_256 } refs/heads/main ${ SHA_256 }\n`), {
    commits: [SHA_256],
  });
});

test('refuses a malformed line by its number', () => {
  const stdinText = `refs/heads/main ${ SHA_A } refs/heads/main ${ SHA_B }\nrefs/heads/main xyz\n`;

  assert.deepEqual(getPushCommits(stdinText), {
    violation:
      'push line 2 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it',
  });
});

test('lists no commits for empty input', () => {
  assert.deepEqual(getPushCommits(''), { commits: [] });
});
