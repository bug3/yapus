import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, openSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import {
  getMessagesWithinLimit,
} from '../../../../hooks/claude/dashes/get-messages-within-limit.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const LIMIT_SECONDS = 0.02;
const LIMIT_MESSAGE = 'yapus dashes: no answer within 0.02 seconds; the call is blocked, retry it';
const SUBPROCESS_TIMEOUT_MS = 10000;
const EM_DASH = String.fromCodePoint(0x2014);

test('gives the finding message for a stream that ends with a dash', async () => {
  const stdin = new PassThrough();

  stdin.end(
    JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: '/r/a.md', content: EM_DASH },
    }),
  );

  assert.deepEqual(await getMessagesWithinLimit(stdin, LIMIT_SECONDS), [
    'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen',
  ]);
});

test('gives the limit message for a stream that never ends', async (t) => {
  const stdin = new PassThrough();

  t.after(() => {
    stdin.destroy();
  });

  assert.deepEqual(await getMessagesWithinLimit(stdin, LIMIT_SECONDS), [LIMIT_MESSAGE]);
});

// The test holds the FIFO open itself, so the read inside getMessages waits for data
// until the test closes it.
test('gives the limit message when the file read of an Edit stalls', async (t) => {
  const fifoPath = join(makeTempDir(t), 'a.md');
  const stdin = new PassThrough();

  execFileSync('mkfifo', [fifoPath], { timeout: SUBPROCESS_TIMEOUT_MS });

  const holder = openSync(fifoPath, constants.O_RDWR);

  t.after(() => {
    closeSync(holder);
  });

  stdin.end(
    JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: fifoPath, old_string: 'a', new_string: 'b' },
    }),
  );

  assert.deepEqual(await getMessagesWithinLimit(stdin, LIMIT_SECONDS), [LIMIT_MESSAGE]);
});
