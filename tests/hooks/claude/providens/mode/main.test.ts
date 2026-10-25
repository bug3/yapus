import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const PROVIDENS = join(HOOKS, 'claude', 'providens');
const MAIN = join(PROVIDENS, 'mode', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const POLICY = readFileSync(join(PROVIDENS, 'policy', 'policy.md'), 'utf8');
const OFF_LINE = readFileSync(join(PROVIDENS, 'mode', 'off.md'), 'utf8');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('writes on for the session and prints the policy', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'sessions', 's1.mode');
  const run = runMode([dataDir, 's1', 'on']);

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(path, 'utf8'), 'on\n');
  assert.equal(run.stdout, `wrote ${ path }; this session is on (session)\n${ POLICY }`);
});

test('writes off for the session and prints the off line', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'sessions', 's1.mode');
  const run = runMode([dataDir, 's1', 'off']);

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(path, 'utf8'), 'off\n');
  assert.equal(run.stdout, `wrote ${ path }; this session is off (session)\n${ OFF_LINE }`);
});

test('writes the global file with --global after the value', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'mode');
  const run = runMode([dataDir, 's1', 'off', '--global']);

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), 'off\n');
  assert.equal(existsSync(join(dataDir, 'sessions')), false);
  assert.equal(run.stdout, `wrote ${ path }; this session is off (global)\n${ OFF_LINE }`);
});

test('writes the global file with --global before the value', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'mode');
  const run = runMode([dataDir, 's1', '--global', 'on']);

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), 'on\n');
  assert.equal(run.stdout, `wrote ${ path }; this session is on (global)\n${ POLICY }`);
});

test('says a session file overrides a global write', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'mode');

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.mode'), 'off\n');

  const run = runMode([dataDir, 's1', 'on', '--global']);

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), 'on\n');
  assert.equal(run.stdout, `wrote ${ path }; this session is off (session)\n${ OFF_LINE }`);
});

test('prints the policy when the mode in force is invalid', (t) => {
  const dataDir = makeTempDir(t);
  const bad = join(dataDir, 'sessions', 's1.mode');
  const path = join(dataDir, 'mode');

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(bad, 'maybe\n');

  const run = runMode([dataDir, 's1', 'off', '--global']);

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), 'off\n');
  assert.equal(
    run.stdout,
    `wrote ${ path }; ${ bad } holds no mode, so the rules apply\n${ POLICY }`,
  );
});

test('does not touch another session', (t) => {
  const dataDir = makeTempDir(t);

  runMode([dataDir, 's1', 'off']);

  assert.deepEqual(readdirSync(join(dataDir, 'sessions')), ['s1.mode']);
});

test('runs through run.sh', (t) => {
  const dataDir = makeTempDir(t);
  const run = spawnSync(
    'bash',
    [RUN_SH, 'claude/providens/mode', dataDir, 's1', 'off'],
    { cwd: tmpdir(), encoding: 'utf8', timeout: SUBPROCESS_TIMEOUT_MS },
  );

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(join(dataDir, 'sessions', 's1.mode'), 'utf8'), 'off\n');
  assert.match(run.stdout, /^wrote [^\n]*; this session is off \(session\)\n/u);
});

for (const [name, args] of [
  ['an empty data dir', ['', 's1', 'on']],
  ['an unsafe id', ['DIR', '../s1', 'on']],
  ['an empty id', ['DIR', '', 'on']],
  ['no value', ['DIR', 's1']],
  ['only --global', ['DIR', 's1', '--global']],
  ['two values', ['DIR', 's1', 'on', 'off']],
  ['the same value twice', ['DIR', 's1', 'on', 'on']],
  ['an unknown value', ['DIR', 's1', 'maybe']],
  ['--global twice', ['DIR', 's1', 'on', '--global', '--global']],
  ['an unknown flag', ['DIR', 's1', 'on', '--force']],
] as const) {
  test(`refuses ${ name } with one usage line, exit 2 and nothing written`, (t) => {
    const dataDir = makeTempDir(t);
    const run = runMode(args.map((arg) => (arg === 'DIR' ? dataDir : arg)));

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^yapus providens mode: usage: [^\n]*\n$/u);
    assert.deepEqual(readdirSync(dataDir), []);
  });
}

function runMode(args: readonly string[]) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    cwd: tmpdir(),
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
