import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeListingHome } from '../../../../helpers/exclusion/make-listing-home.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';

const MAIN = join(
  import.meta.dirname, '..', '..', '..', '..', '..', 'hooks', 'claude', 'gates', 'gh', 'main.ts',
);
const SUBPROCESS_TIMEOUT_MS = 10000;

interface HookRun {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runHook(cwd: string, input: string, env: NodeJS.ProcessEnv): HookRun {
  const { status, stdout, stderr } = spawnSync(process.execPath, [MAIN], {
    cwd,
    encoding: 'utf8',
    env,
    input,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { status, stdout, stderr };
}

// The caller's environment with HOME, the config directory, the plugin data
// directory and the project directory in the test's own directory, so the
// hook reads no exclusion list of the machine and nothing of the session that
// runs the test.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return {
    ...process.env,
    HOME: tempDir,
    CLAUDE_CONFIG_DIR: tempDir,
    CLAUDE_PLUGIN_DATA: tempDir,
    CLAUDE_PROJECT_DIR: tempDir,
  };
}

function makeCall(command: string, cwd: string): string {
  return JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd });
}

test('exits 0 with no output for a command it does not judge', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(
    runHook(dir, makeCall('gh pr list', dir), makeHookEnv(t)),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('exits 2 with one stderr line for a refused call', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(runHook(dir, makeCall('gh pr create --web', dir), makeHookEnv(t)), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: `gh pr create --web` takes its text from where this check cannot '
      + 'read it; give --title and --body-file\n',
  });
});

test('exits 2 with one stderr line for a malformed payload', (t) => {
  assert.deepEqual(runHook(makeTempDir(t), 'nope', makeHookEnv(t)), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: cannot read the tool call (stdin is not JSON); retry the call\n',
  });
});

test('exits 2 for a Bash call whose directory is not absolute', (t) => {
  assert.deepEqual(runHook(makeTempDir(t), makeCall('ls', 'x'), makeHookEnv(t)), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: cannot read the tool call (cwd is not absolute); retry the call\n',
  });
});

test('exits 0 with no output for a tool other than Bash', (t) => {
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/x' } });

  assert.deepEqual(
    runHook(makeTempDir(t), payload, makeHookEnv(t)),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('exits 0 with no output for gh pr create in a listed repository', (t) => {
  const repo = makeTempRepo(t);
  const home = makeListingHome(t, [realpathSync(repo)]);

  assert.deepEqual(
    runHook(repo, makeCall('gh pr create', repo), { ...makeHookEnv(t), HOME: home }),
    { status: 0, stdout: '', stderr: '' },
  );
});
