import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPrompts } from '../../../../../hooks/claude/delegator/recall/read-prompts.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('reads the logged prompts in order and skips a line that is not one', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');

  writeFileSync(
    path,
    '{"time":"t1","prompt":"one"}\n{\n{"time":"t2"}\n[1]\n{"time":"t3","prompt":"three"}\n',
  );

  assert.deepEqual(readPrompts(path), {
    kind: 'prompts',
    prompts: [{ time: 't1', prompt: 'one' }, { time: 't3', prompt: 'three' }],
  });
});

test('returns missing when the session has no log', (t) => {
  assert.deepEqual(readPrompts(join(makeTempDir(t), 's1.jsonl')), { kind: 'missing' });
});

test('fails with the path when the log cannot be read', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');

  mkdirSync(path);

  const read = readPrompts(path);

  assert.ok(read.kind === 'failure');
  assert.match(read.detail, /^cannot read .*s1\.jsonl: EISDIR/u);
});
