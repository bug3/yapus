import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'tyler', 'ashlar', 'start', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const INPUT = JSON.stringify({ session_id: 's1', cwd: '/work', hook_event_name: 'SessionStart' });

test('notes the start and exits 0 for a valid input', (t) => {
  const tempDir = makeTempDir(t);
  const hookRun = runHook(tempDir, INPUT, tempDir);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
  assert.equal(existsSync(join(tempDir, 'ashlar', 's1.start')), true);
});

test('exits 2 with the message when CLAUDE_PLUGIN_DATA is missing', (t) => {
  const hookRun = runHook(makeTempDir(t), INPUT, undefined);

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review: CLAUDE_PLUGIN_DATA is not set/);
});

test('exits 2 for an invalid stdin', (t) => {
  const tempDir = makeTempDir(t);
  const hookRun = runHook(tempDir, 'not json', tempDir);

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review: stdin is not JSON/);
});

test('notes the start through the bash entry point', (t) => {
  const tempDir = makeTempDir(t);
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/tyler/ashlar/start'], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: tempDir },
    input: INPUT,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
  assert.equal(existsSync(join(tempDir, 'ashlar', 's1.start')), true);
});

// In the test's own directory, with HOME and TMPDIR there, so the hook
// writes nothing into the repository.
function runHook(tempDir: string, stdinText: string, dataDir: string | undefined) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: dataDir },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
