import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../../helpers/run-git.ts';
import { makeSizeBranch } from '../../../../helpers/size/make-size-branch.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'tyler', 'git', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const CALL = JSON.stringify({
  tool_name: 'Bash',
  tool_input: { command: 'git status' },
  cwd: '/tmp',
});

test('exits 0 with no output for a plain git status', (t) => {
  const hookRun = runHook(makeHookEnv(t), CALL);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 with one line for a malformed payload', (t) => {
  const hookRun = runHook(makeHookEnv(t), 'nope');

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, 'yapus providens git: cannot read the tool call: stdin is not JSON\n'],
  );
});

test('exits 2 with the timeout line when stdin stays open', { timeout: 8000 }, async (t) => {
  const child = spawn(process.execPath, [MAIN], {
    cwd: makeHookEnv(t).TMPDIR,
    env: makeHookEnv(t),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const stderrChunks: Buffer[] = [];

  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

  const status = await new Promise<number | null>((resolve) => {
    child.on('close', resolve);
  });

  assert.deepEqual(
    [status, Buffer.concat(stderrChunks).toString('utf8')],
    [2, 'yapus providens git: stdin did not arrive within 3 s\n'],
  );
});

test('exits 0 through the bash entry point for a plain git status', (t) => {
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/tyler/git'], {
    encoding: 'utf8',
    env: makeHookEnv(t),
    input: CALL,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stdout, entryRun.stderr], [0, '', '']);
});

// A `gh pr create` that every rule but the size check passes; its body file is written.
function makeCreateCommand(env: NodeJS.ProcessEnv): string {
  const body = join(env.TMPDIR ?? '', 'body.md');

  writeFileSync(body, '## Summary\na\n\n## Test plan\nb\n\nBuilt with yapus\n'
    + 'Co-authored-by: yapus <noreply@yapus.dev>\n');

  return 'gh pr create -d -t "feat(hooks): add a check" -l "type: feat,scope: hooks" '
    + `-F ${ body } --base main`;
}

test('prints the notes of an allowed call as hook context on stdout', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: makeCreateCommand(env) },
    cwd: makeSizeBranch(t),
  }));

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
  assert.deepEqual(JSON.parse(hookRun.stdout), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: 'This pull request changes 456 lines, over 400. '
        + 'Reviewers lose track of a change this size; consider splitting it.',
    },
  });
});

test('refuses a gh pr create when the payload names no working directory', (t) => {
  const env = makeHookEnv(t);
  const hookRun = runHook(env, JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: makeCreateCommand(env) },
  }));

  assert.deepEqual([hookRun.status, hookRun.stdout], [2, '']);
  assert.match(hookRun.stderr, /cannot measure the pull request \(git rev-parse --verify/);
});

function runHook(env: NodeJS.ProcessEnv, stdinText: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: env.TMPDIR,
    encoding: 'utf8',
    env,
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// The caller's environment with HOME and TMPDIR in the test's own directory.
function makeHookEnv(t: TestContext): NodeJS.ProcessEnv {
  const tempDir = makeTempDir(t);

  return { ...getGitEnv(process.env), HOME: tempDir, TMPDIR: tempDir };
}
