import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, constants, openSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getMessagesWithinLimit,
} from '../../../../hooks/git/subject/get-messages-within-limit.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const CATALOGS = join(
  import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git', 'subject', 'catalogs',
);
const SUBPROCESS_TIMEOUT_MS = 10000;

// The test holds the FIFO open itself, so reading the message file waits for
// data until the test closes it.
test('gives the limit message when reading the message file stalls', async (t) => {
  const messagePath = join(makeTempDir(t), 'COMMIT_EDITMSG');

  execFileSync('mkfifo', [messagePath], { timeout: SUBPROCESS_TIMEOUT_MS });

  const holder = openSync(messagePath, constants.O_RDWR);

  t.after(() => {
    closeSync(holder);
  });

  const hookInput = { messagePath, isEditorUsed: false, catalogsPath: CATALOGS };

  assert.deepEqual(await getMessagesWithinLimit(hookInput, 0.02), [
    'yapus subject: no answer within 0.02 seconds; the commit is blocked, retry it',
  ]);
});
