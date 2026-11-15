import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  recordRow,
  type ResumeRow,
  type ReturnRow,
} from '../../../../hooks/claude/delegator/record-row.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const RETURN: ReturnRow = {
  time: 't',
  hook: 'return',
  sessionId: 's',
  subject: 'delegator:reader',
  allowed: true,
  reason: '',
  agentId: 'a1',
  status: 'DONE',
  verdict: undefined,
  length: 4,
  turns: undefined,
  toolUses: undefined,
  tokens: undefined,
  durationMs: undefined,
  model: undefined,
};

test('appends each row as one JSON line, creating the directory', (t) => {
  const dataDir = join(makeTempDir(t), 'data');

  recordRow(dataDir, RETURN);
  recordRow(dataDir, { ...RETURN, allowed: false, reason: 'r' });

  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"return","sessionId":"s","subject":"delegator:reader","allowed":true,'
      + '"reason":"","agentId":"a1","status":"DONE","length":4}\n'
      + '{"time":"t","hook":"return","sessionId":"s","subject":"delegator:reader","allowed":false,'
      + '"reason":"r","agentId":"a1","status":"DONE","length":4}\n',
  );
});

test('appends a resume row as one JSON line', (t) => {
  const dataDir = makeTempDir(t);
  const resume: ResumeRow = {
    time: 't',
    hook: 'resume',
    sessionId: 's',
    agentId: 'a1',
    toolUseId: 'toolu_1',
  };

  recordRow(dataDir, resume);

  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"resume","sessionId":"s","agentId":"a1","toolUseId":"toolu_1"}\n',
  );
});
