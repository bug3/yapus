import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPushRecords } from '../../../../hooks/git/push/get-push-records.ts';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const ZERO_SHA = '0000000000000000000000000000000000000000';

test('reads the four fields of a push line', () => {
  assert.deepEqual(getPushRecords(`refs/heads/feat ${ SHA_A } refs/heads/main ${ SHA_B }\n`), {
    records: [{
      localRef: 'refs/heads/feat',
      localSha: SHA_A,
      remoteRef: 'refs/heads/main',
      remoteSha: SHA_B,
    }],
  });
});

test('keeps a deletion with its remote fields', () => {
  assert.deepEqual(getPushRecords(`(delete) ${ ZERO_SHA } refs/heads/old ${ SHA_B }\n`), {
    records: [{
      localRef: '(delete)',
      localSha: ZERO_SHA,
      remoteRef: 'refs/heads/old',
      remoteSha: SHA_B,
    }],
  });
});

test('keeps the lines in stdin order', () => {
  const stdinText = [
    `refs/heads/a ${ SHA_A } refs/heads/a ${ ZERO_SHA }`,
    `refs/heads/b ${ SHA_B } refs/heads/b ${ ZERO_SHA }`,
    '',
  ].join('\n');

  assert.deepEqual(getPushRecords(stdinText), {
    records: [
      {
        localRef: 'refs/heads/a',
        localSha: SHA_A,
        remoteRef: 'refs/heads/a',
        remoteSha: ZERO_SHA,
      },
      {
        localRef: 'refs/heads/b',
        localSha: SHA_B,
        remoteRef: 'refs/heads/b',
        remoteSha: ZERO_SHA,
      },
    ],
  });
});

test('refuses a malformed line by its number', () => {
  const stdinText = `refs/heads/main ${ SHA_A } refs/heads/main ${ SHA_B }\nrefs/heads/main xyz\n`;

  assert.deepEqual(getPushRecords(stdinText), {
    violation:
      'push line 2 is not "<local ref> <local sha> <remote ref> <remote sha>"; the push is blocked, retry it',
  });
});

test('reads no records from empty input', () => {
  assert.deepEqual(getPushRecords(''), { records: [] });
});
