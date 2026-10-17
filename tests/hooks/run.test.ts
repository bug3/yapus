import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../support/make-temp-dir.ts';

interface RunOptions {
  readonly input: string;
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
}

const RUN_SH = join(import.meta.dirname, '..', '..', 'hooks', 'run.sh');
const STUB = 'stub';
const BASH = getCommandPath('bash');

test('exits 0 and passes stdin through when the hook passes', (t) => {
  const sandbox = makeSandbox(
    t,
    "import { text } from 'node:stream/consumers';\nprocess.stdout.write(await text(process.stdin));\n",
  );

  const result = run(sandbox, STUB, { input: '{"a":1}', env: process.env, cwd: sandbox });

  assert.deepEqual([result.status, result.stdout, result.stderr], [0, '{"a":1}', '']);
});

test('exits 2 with no message of its own when the hook exits 2', (t) => {
  const sandbox = makeSandbox(t, 'process.exit(2);\n');

  const result = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.deepEqual([result.status, result.stderr], [2, '']);
});

test('exits 2 and names the exit when the hook throws', (t) => {
  const sandbox = makeSandbox(t, "throw new Error('boom');\n");

  const result = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /yapus run\.sh: hook stub failed with exit 1; the call is blocked, fix the hook\n$/,
  );
});

test('exits 2 when the hook is killed', (t) => {
  const sandbox = makeSandbox(t, "process.kill(process.pid, 'SIGKILL');\n");

  const result = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /yapus run\.sh: hook stub failed with exit 137; the call is blocked, fix the hook\n$/,
  );
});

function getCommandPath(command: string): string {
  return execFileSync('/bin/sh', ['-c', `command -v ${ command }`], { encoding: 'utf8' }).trim();
}

// A temporary copy of run.sh beside one stub hook.
function makeSandbox(t: TestContext, stubSource: string): string {
  const sandbox = makeTempDir(t);

  copyFileSync(RUN_SH, join(sandbox, 'run.sh'));
  mkdirSync(join(sandbox, STUB));
  writeFileSync(join(sandbox, STUB, 'main.ts'), stubSource);

  return sandbox;
}

function run(sandbox: string, hookName: string, { input, env, cwd }: RunOptions) {
  return spawnSync(
    BASH,
    [join(sandbox, 'run.sh'), hookName],
    { cwd, encoding: 'utf8', env, input },
  );
}
