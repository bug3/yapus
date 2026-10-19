import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeGateFixture, setThreshold, THREE_LINES } from './make-gate-fixture.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'tyler', 'ashlar', 'gate', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 20000;

function makeStdin(cwd: string, isRetry = false): string {
  return JSON.stringify({
    session_id: 's1',
    cwd,
    hook_event_name: 'Stop',
    stop_hook_active: isRetry,
  });
}

// In a directory of its own, with HOME and TMPDIR there, so the hook writes
// nothing into the repository.
function runHook(tempDir: string, stdinText: string, dataDir: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: dataDir },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

test('exits 2 with the request on stderr for a change that needs review', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const hookRun = runHook(makeTempDir(t), makeStdin(fixture.repo), fixture.dataDir);

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review gate: the change since [0-9a-f]{12} has 3 /);
});

test('exits 0 for a change that needs no review', (t) => {
  const fixture = makeGateFixture(t);
  const hookRun = runHook(makeTempDir(t), makeStdin(fixture.repo), fixture.dataDir);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 for a failure', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, 'many');

  const hookRun = runHook(makeTempDir(t), makeStdin(fixture.repo), fixture.dataDir);

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review gate: .*holds no whole number/);
});

test('exits 0 with the message for a failure on the retry', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, 'many');

  const hookRun = runHook(makeTempDir(t), makeStdin(fixture.repo, true), fixture.dataDir);

  assert.equal(hookRun.status, 0);
  assert.match(hookRun.stderr, /^yapus providens review gate: .*holds no whole number/);
});

test('exits 2 for an invalid stdin', (t) => {
  const hookRun = runHook(makeTempDir(t), 'not json', makeTempDir(t));

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review gate: stdin is not JSON/);
});

test('sends the session back through the bash entry point', (t) => {
  const fixture = makeGateFixture(t);
  const tempDir = makeTempDir(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const entryRun = spawnSync('bash', [RUN_SH, 'claude/tyler/ashlar/gate'], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: fixture.dataDir },
    input: makeStdin(fixture.repo),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(entryRun.status, 2);
  assert.match(entryRun.stderr, /^yapus providens review gate: the change since /);
});

test('exits 0 with the message for an invalid input on the retry', (t) => {
  const stdinText = JSON.stringify({ session_id: 'a/b', stop_hook_active: true });
  const hookRun = runHook(makeTempDir(t), stdinText, makeTempDir(t));

  assert.equal(hookRun.status, 0);
  assert.match(hookRun.stderr, /^yapus providens review gate: session_id is not/);
});
