import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getReturnVerdict,
} from '../../../../../hooks/claude/tyler/return/get-return-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIELDS = { session_id: 's1', agent_type: 'providens:deacon' };
const SHORT = JSON.stringify({ ...FIELDS, last_assistant_message: 'a'.repeat(12000) });
const LONG_FIELDS = { ...FIELDS, last_assistant_message: 'a'.repeat(12001) };
const LONG = JSON.stringify(LONG_FIELDS);

test('passes a return at the cap and logs it', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getReturnVerdict({ stdinText: SHORT, dataDir, time: 't' }), { kind: 'pass' });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"hook":"return".*"allowed":true/);
});

test('sends back a first return over the cap and says why', (t) => {
  const dataDir = makeTempDir(t);

  assert.deepEqual(getReturnVerdict({ stdinText: LONG, dataDir, time: 't' }), {
    kind: 'shorten',
    detail: 'the return has 12001 characters, over the cap of 12000; return the most useful '
      + 'part, say what was cut and name the follow-up questions',
  });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"allowed":false/);
});

test('passes a second return over the cap and logs its length', (t) => {
  const dataDir = makeTempDir(t);
  const retry = JSON.stringify({ ...LONG_FIELDS, stop_hook_active: true });

  assert.deepEqual(getReturnVerdict({ stdinText: retry, dataDir, time: 't' }), { kind: 'pass' });
  assert.match(readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'), /"reason":"12001 characters"/);
});

// A log written to an empty directory name would throw, so passing is the
// proof that none was tried.
test('judges without a log when the plugin data directory is empty', () => {
  const verdict = getReturnVerdict({ stdinText: SHORT, dataDir: '', time: 't' });

  assert.deepEqual(verdict, { kind: 'pass' });
});

test('blocks a stop it cannot read', () => {
  assert.deepEqual(getReturnVerdict({ stdinText: '{', dataDir: undefined, time: 't' }), {
    kind: 'shorten',
    detail: 'stdin is not JSON; the stop is blocked',
  });
});
