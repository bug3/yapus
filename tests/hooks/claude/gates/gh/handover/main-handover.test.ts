import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';

const MAIN = join(
  import.meta.dirname,
  '..', '..', '..', '..', '..', '..', 'hooks', 'claude', 'gates', 'gh', 'main.ts',
);
const SUBPROCESS_TIMEOUT_MS = 10000;
const BODY = '## Summary\na\n\n## Test plan\nb\n\nBuilt with [yapus](https://yapus.dev)\n';
const MERGE_RULE = '---\ndescription: "About merging."\nevent: "gh pr merge"\n---\n';
const CREATE_RULE = '---\ndescription: "About creating."\nevent: "gh pr create"\n---\n';
const HEADING_A = 'Project memory, .yapus/memory/rules/a.md applies to this call:';
const HEADING_B = 'Project memory, .yapus/memory/rules/b.md applies to this call:';

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

// The caller's environment with HOME, the config directory and the plugin
// data directory in the test's own directory and a project of its own whose
// memory holds the files, so the hook reads no exclusion list of the machine
// and nothing of the session that runs the test.
function makeHookEnv(t: TestContext, files: readonly TempFile[]): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return {
    ...process.env,
    HOME: tempDir,
    CLAUDE_CONFIG_DIR: tempDir,
    CLAUDE_PLUGIN_DATA: tempDir,
    CLAUDE_PROJECT_DIR: makeMemoryProject(t, files),
  };
}

function makeCall(command: string, cwd: string): string {
  return JSON.stringify({ session_id: 's1', tool_name: 'Bash', tool_input: { command }, cwd });
}

// The line the hook prints to hand the text over.
function makeOutput(additionalContext: string): string {
  const output = { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext } };

  return `${ JSON.stringify(output) }\n`;
}

test('hands a passed gh call the rules that name its command, in name order', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [
    { path: 'rules/b.md', text: `${ MERGE_RULE }\nSay b.\n` },
    { path: 'rules/a.md', text: `${ MERGE_RULE }\nSay a.\n` },
    { path: 'rules/c.md', text: `${ CREATE_RULE }\nSay c.\n` },
  ]);

  assert.deepEqual(runHook(dir, makeCall('gh pr merge 5', dir), env), {
    status: 0,
    stdout: makeOutput(`${ HEADING_A }\nSay a.\n\n${ HEADING_B }\nSay b.`),
    stderr: '',
  });
});

test('hands a gh pr new whose form passes the rule of gh pr create', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [
    { path: 'rules/a.md', text: `${ CREATE_RULE }\nSay a.\n` },
    { path: 'rules/b.md', text: `${ MERGE_RULE }\nSay b.\n` },
  ]);

  writeFileSync(join(dir, 'b.md'), BODY);

  assert.deepEqual(runHook(dir, makeCall('gh pr new -t "Add a check" -F b.md', dir), env), {
    status: 0,
    stdout: makeOutput(`${ HEADING_A }\nSay a.`),
    stderr: '',
  });
});

test('exits 2 with the reason alone for a refused gh pr create that a rule names', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [{ path: 'rules/a.md', text: `${ CREATE_RULE }\nSay a.\n` }]);

  assert.deepEqual(runHook(dir, makeCall('gh pr create --web', dir), env), {
    status: 2,
    stdout: '',
    stderr: 'yapus gh check: `gh pr create --web` takes its text from where this check cannot '
      + 'read it; give --title and --body-file\n',
  });
});

test('hands nothing to a gh call that no rule names', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [{ path: 'rules/a.md', text: `${ MERGE_RULE }\nSay a.\n` }]);

  assert.deepEqual(
    runHook(dir, makeCall('gh pr list', dir), env),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('hands nothing for a command that cannot be split', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [{ path: 'rules/a.md', text: `${ MERGE_RULE }\nSay a.\n` }]);

  assert.deepEqual(
    runHook(dir, makeCall('gh pr merge 5 "a', dir), env),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('hands nothing in a session switched off', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [{ path: 'rules/a.md', text: `${ MERGE_RULE }\nSay a.\n` }]);

  writeFileSync(join(env.CLAUDE_PLUGIN_DATA ?? '', 'mode'), 'off');

  assert.deepEqual(
    runHook(dir, makeCall('gh pr merge 5', dir), env),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('exits 0 with no output where a file stands in the place of the memory directory', (t) => {
  const dir = makeTempDir(t);
  const env = { ...makeHookEnv(t, []), CLAUDE_PROJECT_DIR: dir };

  mkdirSync(join(dir, '.yapus'));
  writeFileSync(join(dir, '.yapus', 'memory'), 'x');

  assert.deepEqual(
    runHook(dir, makeCall('gh pr merge 5', dir), env),
    { status: 0, stdout: '', stderr: '' },
  );
});

test('exits 0 with no error line when the rule cannot be written to stdout', (t) => {
  const dir = makeTempDir(t);
  const env = makeHookEnv(t, [{ path: 'rules/a.md', text: `${ MERGE_RULE }\nSay a.\n` }]);
  // Open for reading alone, so a write to it fails.
  const unwritable = openSync(dir, 'r');

  t.after(() => {
    closeSync(unwritable);
  });

  const { status, stderr } = spawnSync(process.execPath, [MAIN], {
    cwd: dir,
    encoding: 'utf8',
    env,
    input: makeCall('gh pr merge 5', dir),
    stdio: ['pipe', unwritable, 'pipe'],
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual({ status, stderr }, { status: 0, stderr: '' });
});
