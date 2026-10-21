import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/git/get-verdict.ts';
import {
  secretFiles,
} from '../../../../../hooks/claude/tyler/git/rules/secrets/secret-files.ts';

const HOME = '/home/someone';

function bashCall(command: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: '/tmp' });
}

test('denies a command that shows a secret file, git or not', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('cat .env'), home: HOME }), {
    kind: 'deny',
    detail: secretFiles.reasons.shown('cat', '.env'),
  });
});

test('denies a secret file before a git rule reads the line', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('git add .env'), home: HOME }), {
    kind: 'deny',
    detail: secretFiles.reasons.shown('git', '.env'),
  });
});

test('denies a line it cannot split when the text names a secret file', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall("cat .env 'oops"), home: HOME }), {
    kind: 'deny',
    detail: secretFiles.reasons.unreadable('.env'),
  });
});

test('allows a command that lists a secret file', () => {
  assert.deepEqual(getVerdict({ stdinText: bashCall('ls .env'), home: HOME }), {
    kind: 'allow',
  });
});
