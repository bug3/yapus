import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { logDecision } from '../../../../../hooks/claude/providens/launch/log-decision.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const DECISION = {
  time: 't',
  hook: 'launch',
  sessionId: 's',
  subject: 'providens:deacon',
  allowed: true,
  reason: '',
};

test('appends each decision as one JSON line, creating the directory', (t) => {
  const dataDir = join(makeTempDir(t), 'data');

  logDecision(dataDir, DECISION);
  logDecision(dataDir, { ...DECISION, allowed: false, reason: 'r' });

  assert.equal(
    readFileSync(join(dataDir, 'decisions.jsonl'), 'utf8'),
    '{"time":"t","hook":"launch","sessionId":"s","subject":"providens:deacon","allowed":true,'
      + '"reason":""}\n'
      + '{"time":"t","hook":"launch","sessionId":"s","subject":"providens:deacon","allowed":false,'
      + '"reason":"r"}\n',
  );
});
