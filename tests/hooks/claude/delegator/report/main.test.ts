import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, realpathSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import {
  RETURN_WORDS_PATH,
} from '../../../../../hooks/claude/delegator/contract/read-return-words.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'delegator', 'report', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 10000;
const ROW = '{"time":"t","hook":"launch","sessionId":"s","subject":"delegator:reader",'
  + '"allowed":true,"reason":"","description":"[deep] x"}\n';

test('exits 0 and prints the report of the record in the directory argument', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'decisions.jsonl'), ROW);

  const run = runReport([dataDir], {});

  assert.equal(run.status, 0);
  assert.match(run.stdout, /^# delegator record report\n/u);
  assert.match(run.stdout, /\n\| delegator:reader \| 1 \|/u);
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
    /^yapus delegator report: cannot read .*decisions\.jsonl: ENOENT/u,
  );
});

test('exits 2 and names the return words file it cannot read', (t) => {
  const hooks = join(realpathSync(makeTempDir(t)), 'hooks');
  const wordsPath = join(hooks, relative(HOOKS, RETURN_WORDS_PATH));

  cpSync(HOOKS, hooks, { recursive: true });
  writeFileSync(wordsPath, '{');

  const run = runReport([makeTempDir(t)], {}, join(hooks, relative(HOOKS, MAIN)));

  assert.equal(run.status, 2);
  assert.equal(run.stderr, `yapus delegator report: ${ wordsPath } is not JSON; fix the file\n`);
});

function runReport(args: readonly string[], env: NodeJS.ProcessEnv, main = MAIN) {
  return spawnSync(process.execPath, [main, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_DATA: '', ...env },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
