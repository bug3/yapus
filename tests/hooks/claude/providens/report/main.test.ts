import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const MAIN = join(
  import.meta.dirname, '..', '..', '..', '..', '..', 'hooks', 'claude', 'providens', 'report',
  'main.ts',
);
const SUBPROCESS_TIMEOUT_MS = 10000;
const ROW = '{"time":"t","hook":"launch","sessionId":"s","subject":"providens:deacon",'
  + '"allowed":true,"reason":"","description":"[deep] x"}\n';

test('exits 0 and prints the report of the record in the directory argument', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'decisions.jsonl'), ROW);

  const run = runReport([dataDir], {});

  assert.equal(run.status, 0);
  assert.match(run.stdout, /^# providens record report\n/u);
  assert.match(run.stdout, /\n\| providens:deacon \| 1 \|/u);
});

test('reads the record from CLAUDE_PLUGIN_DATA without an argument', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'decisions.jsonl'), ROW);

  assert.equal(runReport([], { CLAUDE_PLUGIN_DATA: dataDir }).status, 0);
});

test('exits 2 and names the file it cannot read', (t) => {
  const dataDir = makeTempDir(t);
  const run = runReport([dataDir], {});

  assert.equal(run.status, 2);
  assert.match(
    run.stderr,
    /^yapus providens report: cannot read .*decisions\.jsonl: ENOENT/u,
  );
});

function runReport(args: readonly string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_DATA: '', ...env },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
