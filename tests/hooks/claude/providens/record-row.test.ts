import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { type Decision, recordRow } from '../../../../hooks/claude/providens/record-row.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const DECISION: Decision = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: 'providens:deacon',
  allowed: true,
  reason: '',
};

test('appends each row as one JSON line, creating the directory', (t) => {
  const dataDir = join(makeTempDir(t), 'data');

  recordRow(dataDir, DECISION);
  recordRow(dataDir, { ...DECISION, allowed: false, reason: 'r' });

  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"launch","sessionId":"s","subject":"providens:deacon","allowed":true,'
      + '"reason":""}\n'
      + '{"time":"t","hook":"launch","sessionId":"s","subject":"providens:deacon","allowed":false,'
      + '"reason":"r"}\n',
  );
});
