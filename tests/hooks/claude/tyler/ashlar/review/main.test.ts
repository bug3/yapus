import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'tyler', 'ashlar', 'review', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 20000;

function makeStdin(event: string, cwd: string, extra: object = {}): string {
  return JSON.stringify({
    session_id: 's1',
    cwd,
    hook_event_name: event,
    agent_id: 'agent-1',
    ...extra,
  });
}

// In the temp directory, which is also HOME, TMPDIR and the data dir, so nothing
// lands in the repository.
function runHook(entry: readonly string[], tempDir: string, stdinText: string) {
  return spawnSync(entry[0] ?? '', entry.slice(1), {
    cwd: tempDir,
    encoding: 'utf8',
    env: { ...process.env, HOME: tempDir, TMPDIR: tempDir, CLAUDE_PLUGIN_DATA: tempDir },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

test('ends a start and stop round trip with one acceptance line', (t) => {
  const repo = makeCommittedRepo(t);
  const dataDir = makeTempDir(t);
  const entry = ['bash', RUN_SH, 'claude/tyler/ashlar/review'];
  const started = runHook(entry, dataDir, makeStdin('SubagentStart', repo));
  const stopped = runHook(
    entry,
    dataDir,
    makeStdin('SubagentStop', repo, { last_assistant_message: 'DONE\nAPPROVE' }),
  );

  assert.deepEqual([started.status, stopped.status], [0, 0]);
  const lines = readFileSync(join(dataDir, 'ashlar', 's1.jsonl'), 'utf8').trim().split('\n');

  assert.equal(lines.length, 1);
});

test('exits 2 with the message on a failure', (t) => {
  const tempDir = makeTempDir(t);
  const hookRun = runHook([process.execPath, MAIN], tempDir, makeStdin('Stop', tempDir));

  assert.equal(hookRun.status, 2);
  assert.match(hookRun.stderr, /^yapus providens review record: unexpected event Stop/u);
});

test('exits 0 on the same failure when the stop hook already ran', (t) => {
  const tempDir = makeTempDir(t);
  const stdinText = makeStdin('Stop', tempDir, { stop_hook_active: true });
  const hookRun = runHook([process.execPath, MAIN], tempDir, stdinText);

  assert.equal(hookRun.status, 0);
  assert.match(hookRun.stderr, /unexpected event Stop/u);
});
