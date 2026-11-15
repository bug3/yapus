import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  CONTRACT_PATH,
  getContext,
} from '../../../../../hooks/claude/delegator/contract/get-context.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('outputs the contract as SubagentStart context with the cap filled in', (t) => {
  const path = makeContract(t, 'within {return-cap} characters\n');

  assert.deepEqual(getContext(path), {
    kind: 'output',
    json: '{"hookSpecificOutput":{"hookEventName":"SubagentStart",'
      + '"additionalContext":"within 12000 characters\\n"}}',
  });
});

test('fails on a contract that is not on disk', (t) => {
  const context = getContext(join(makeTempDir(t), 'gone.md'));

  assert.ok(context.kind === 'failure');
  assert.match(context.detail, /^cannot read .*gone\.md: ENOENT/);
});

test('fails on a contract without the cap placeholder or with two', (t) => {
  const none = makeContract(t, 'no cap\n');
  const two = makeContract(t, '{return-cap} {return-cap}\n');

  assert.deepEqual([getContext(none), getContext(two)], [
    { kind: 'failure', detail: `${ none } does not hold {return-cap} once` },
    { kind: 'failure', detail: `${ two } does not hold {return-cap} once` },
  ]);
});

test('fills the cap into the shipped contract', () => {
  const context = getContext(CONTRACT_PATH);

  assert.ok(context.kind === 'output');
  assert.match(context.json, /within 12000 characters/);
});

function makeContract(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'contract.md');

  writeFileSync(path, text);

  return path;
}
