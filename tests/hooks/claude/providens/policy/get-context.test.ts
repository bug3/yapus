import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  getContext,
  MAX_CHARACTERS,
  POLICY_PATH,
  readPolicy,
} from '../../../../../hooks/claude/providens/policy/get-context.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('outputs the policy as SessionStart context', (t) => {
  const path = makePolicy(t, '# P\n');

  assert.deepEqual(getContext(path), {
    kind: 'output',
    json: '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"# P\\n"}}',
  });
});

test('fails on a policy that is not on disk', (t) => {
  const path = join(makeTempDir(t), 'gone.md');
  const context = getContext(path);

  assert.ok(context.kind === 'failure');
  assert.match(context.detail, /^cannot read .*gone\.md: ENOENT/);
});

test('fails on an empty policy', (t) => {
  const path = makePolicy(t, ' \n');

  assert.deepEqual(getContext(path), { kind: 'failure', detail: `${ path } is empty` });
});

test('fails on a policy over the character limit', (t) => {
  const path = makePolicy(t, 'a'.repeat(10001));

  assert.deepEqual(getContext(path), {
    kind: 'failure',
    detail: `${ path } has 10001 characters, over 10000`,
  });
});

test('keeps the shipped policy within the limit', () => {
  assert.equal(MAX_CHARACTERS, 10000);
  assert.equal(getContext(POLICY_PATH).kind, 'output');
});

test('reads the policy text', (t) => {
  const path = makePolicy(t, '# P\n');

  assert.deepEqual(readPolicy(path), { kind: 'text', text: '# P\n' });
});

test('fails to read a policy that is not on disk', (t) => {
  const policy = readPolicy(join(makeTempDir(t), 'gone.md'));

  assert.ok(policy.kind === 'failure');
  assert.match(policy.detail, /^cannot read .*gone\.md: ENOENT/);
});

function makePolicy(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'policy.md');

  writeFileSync(path, text);

  return path;
}
