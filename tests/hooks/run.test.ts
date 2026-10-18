import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../helpers/make-temp-dir.ts';

interface RunOptions {
  readonly input: string;
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
}

const RUN_SH = join(import.meta.dirname, '..', '..', 'hooks', 'run.sh');
const STUB = 'stub';
const NAME_RULE =
  'is not segments of lowercase letters and digits joined by /; fix the hook command';
const SHELLCHECK_VERSION = '0.11.0';
const SUBPROCESS_TIMEOUT_MS = 10000;
const BASH = getCommandPath('bash');
const DIRNAME = getCommandPath('dirname');

test('exits 0 and passes stdin through when the hook passes', (t) => {
  const sandbox = makeSandbox(
    t,
    "import { text } from 'node:stream/consumers';\nprocess.stdout.write(await text(process.stdin));\n",
  );

  const entryRun = run(sandbox, STUB, { input: '{"a":1}', env: process.env, cwd: sandbox });

  assert.deepEqual([entryRun.status, entryRun.stdout, entryRun.stderr], [0, '{"a":1}', '']);
});

test('exits 2 with no message of its own when the hook exits 2', (t) => {
  const sandbox = makeSandbox(t, 'process.exit(2);\n');

  const entryRun = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.deepEqual([entryRun.status, entryRun.stderr], [2, '']);
});

test('exits 2 and names the exit when the hook throws', (t) => {
  const sandbox = makeSandbox(t, "throw new Error('boom');\n");

  const entryRun = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.equal(entryRun.status, 2);
  assert.match(
    entryRun.stderr,
    /yapus run\.sh: hook stub failed with exit 1; the call is blocked, fix the hook\n$/,
  );
});

test('exits 2 when the hook is killed', (t) => {
  const sandbox = makeSandbox(t, "process.kill(process.pid, 'SIGKILL');\n");

  const entryRun = run(sandbox, STUB, { input: '', env: process.env, cwd: sandbox });

  assert.equal(entryRun.status, 2);
  assert.match(
    entryRun.stderr,
    /yapus run\.sh: hook stub failed with exit 137; the call is blocked, fix the hook\n$/,
  );
});

test('finds its hook when started from another directory', (t) => {
  const sandbox = makeSandbox(t, '');

  const entryRun = run(sandbox, STUB, { input: '', env: process.env, cwd: '/' });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
});

test('runs the hook at a name of segments joined by a slash', (t) => {
  const sandbox = makeSandbox(t, '');

  mkdirSync(join(sandbox, 'group', STUB), { recursive: true });
  writeFileSync(join(sandbox, 'group', STUB, 'main.ts'), "process.stdout.write('nested');\n");

  const entryRun = run(sandbox, `group/${ STUB }`, { input: '', env: process.env, cwd: sandbox });

  assert.deepEqual([entryRun.status, entryRun.stdout, entryRun.stderr], [0, 'nested', '']);
});

test('exits 2 when the hook name is not segments of lowercase letters and digits', (t) => {
  const sandbox = makeSandbox(t, '');

  const entryRun = run(sandbox, '../stub', { input: '', env: process.env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, `yapus run.sh: hook name ../stub ${ NAME_RULE }\n`],
  );
});

test('exits 2 when the hook name has an empty segment or an outer slash', (t) => {
  const sandbox = makeSandbox(t, '');
  const names = ['group//stub', '/stub', 'stub/'];

  const entryRuns = names.map((name) => run(sandbox, name, {
    input: '',
    env: process.env,
    cwd: sandbox,
  }));

  assert.deepEqual(
    entryRuns.map(({ status, stderr }) => [status, stderr]),
    names.map((name) => [2, `yapus run.sh: hook name ${ name } ${ NAME_RULE }\n`]),
  );
});

test('keeps the message on one line when the hook name holds a line feed', (t) => {
  const sandbox = makeSandbox(t, '');

  const entryRun = run(sandbox, 'bad\nname', { input: '', env: process.env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, `yapus run.sh: hook name $'bad\\nname' ${ NAME_RULE }\n`],
  );
});

test('exits 2 when no hook has the name', (t) => {
  const sandbox = makeSandbox(t, '');

  const entryRun = run(sandbox, 'other', { input: '', env: process.env, cwd: sandbox });

  assert.equal(entryRun.status, 2);
  assert.match(entryRun.stderr, /^yapus run\.sh: no hook at .*\/other\/main\.ts; fix the hook command\n$/);
});

test('exits 2 with an install line when node is missing', (t) => {
  const sandbox = makeSandbox(t, '');
  const env = makeEnvWithoutNode(sandbox);

  const entryRun = run(sandbox, STUB, { input: '', env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, 'yapus run.sh: node not found; install Node 24 or newer\n'],
  );
});

test('exits 2 with an install line when node cannot report its version', (t) => {
  const sandbox = makeSandbox(t, '');
  const env = makeEnvWithNode(sandbox, '#!/bin/sh\nexit 1\n');

  const entryRun = run(sandbox, STUB, { input: '', env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, 'yapus run.sh: node did not report its version; install Node 24 or newer\n'],
  );
});

test('exits 2 with an install line when node reports a version that is not a number', (t) => {
  const sandbox = makeSandbox(t, '');
  const env = makeEnvWithNode(sandbox, '#!/bin/sh\necho v24\n');

  const entryRun = run(sandbox, STUB, { input: '', env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, "yapus run.sh: node reported version 'v24'; install Node 24 or newer\n"],
  );
});

test('exits 2 with an install line when node is older than 24', (t) => {
  const sandbox = makeSandbox(t, '');
  const env = makeEnvWithNode(sandbox, '#!/bin/sh\necho 22\n');

  const entryRun = run(sandbox, STUB, { input: '', env, cwd: sandbox });

  assert.deepEqual(
    [entryRun.status, entryRun.stderr],
    [2, 'yapus run.sh: node 22 found; install Node 24 or newer\n'],
  );
});

test('finds shellcheck at the pinned version', () => {
  const shellcheckRun = spawnSync('shellcheck', ['--version'], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(shellcheckRun.error, undefined, `install shellcheck ${ SHELLCHECK_VERSION }`);
  assert.match(
    shellcheckRun.stdout,
    new RegExp(`version: ${ SHELLCHECK_VERSION.replaceAll('.', '\\.') }\n`),
    `install shellcheck ${ SHELLCHECK_VERSION }`,
  );
});

test('passes shellcheck with no findings', () => {
  const shellcheckRun = spawnSync('shellcheck', [RUN_SH], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([shellcheckRun.status, shellcheckRun.stdout], [0, '']);
});

function getCommandPath(command: string): string {
  return execFileSync('/bin/sh', ['-c', `command -v ${ command }`], {
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  }).trim();
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
    { cwd, encoding: 'utf8', env, input, timeout: SUBPROCESS_TIMEOUT_MS },
  );
}

// An environment whose PATH holds dirname and a stub node script.
function makeEnvWithNode(sandbox: string, nodeScript: string): NodeJS.ProcessEnv {
  const env = makeEnvWithoutNode(sandbox);

  writeFileSync(join(sandbox, 'bin', 'node'), nodeScript, { mode: 0o755 });

  return env;
}

// An environment whose PATH holds dirname and no node.
function makeEnvWithoutNode(sandbox: string): NodeJS.ProcessEnv {
  const bin = join(sandbox, 'bin');

  mkdirSync(bin);
  symlinkSync(DIRNAME, join(bin, 'dirname'));

  return { ...process.env, PATH: bin };
}
