import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { readStdin } from '../../../../hooks/git/push/read-stdin.ts';

const LIMIT_MS = 100;

test('reads the stream until it ends', async () => {
  const stdin = new PassThrough();

  stdin.end('refs/heads/main a refs/heads/main b\n');

  assert.equal(await readStdin(stdin, LIMIT_MS), 'refs/heads/main a refs/heads/main b\n');
});

test('returns undefined when the stream does not end within the limit', async () => {
  const stdin = new PassThrough();

  stdin.write('refs/heads/main');

  assert.equal(await readStdin(stdin, LIMIT_MS), undefined);
});
