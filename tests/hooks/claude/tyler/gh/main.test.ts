import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const MAIN = join(
  import.meta.dirname, '..', '..', '..', '..', '..', 'hooks', 'claude', 'tyler', 'gh', 'main.ts',
);
const SUBPROCESS_TIMEOUT_MS = 10000;

interface HookRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runHook(cwd: string, input: string): HookRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [MAIN], {
    cwd,
    encoding: 'utf8',
    input,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { status, stdout, stderr };
}

function makeCall(command: string, cwd: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd });
}

test('exits 0 with no output for a command it does not judge', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(
    runHook(dir, makeCall('gh pr list', dir)),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('exits 2 with one stderr line for a refused call', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(runHook(dir, makeCall('gh pr create --web', dir)), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: `gh pr create --web` takes its text from where this check cannot '
      + 'read it; give --title and --body-file\n',
  });
});

test('exits 2 with one stderr line for a malformed payload', (t) => {
  assert.deepEqual(runHook(makeTempDir(t), 'nope'), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: cannot read the tool call (stdin is not JSON); retry the call\n',
  });
});

test('exits 2 for a Bash call whose directory is not absolute', (t) => {
  assert.deepEqual(runHook(makeTempDir(t), makeCall('ls', 'x')), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: cannot read the tool call (cwd is not absolute); retry the call\n',
  });
});

test('exits 0 with no output for a tool other than Bash', (t) => {
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/x' } });

  assert.deepEqual(runHook(makeTempDir(t), payload), { status: 0, stdout: '', stderr: '' });
});
