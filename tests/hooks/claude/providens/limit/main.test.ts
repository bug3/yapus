import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readLimit } from '../../../../../hooks/claude/providens/settings/read-limit.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'providens', 'limit', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;

test('writes the limit for the session', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'sessions', 's1.launch-limit');
  const run = runLimit([dataDir, 's1', '60'], makeTempDir(t));

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(path, 'utf8'), '60\n');
  assert.equal(run.stdout, `wrote ${ path }; this session's launch limit is 60 (session)\n`);
});

test('writes the global file with --global after the value', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'launch-limit');
  const run = runLimit([dataDir, 's1', '7', '--global'], makeTempDir(t));

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(path, 'utf8'), '7\n');
  assert.equal(existsSync(join(dataDir, 'sessions')), false);
  assert.equal(run.stdout, `wrote ${ path }; this session's launch limit is 7 (global)\n`);
});

test('writes the global file with --global before the value', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'launch-limit');
  const run = runLimit([dataDir, 's1', '--global', '0'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), '0\n');
  assert.equal(run.stdout, `wrote ${ path }; this session's launch limit is 0 (global)\n`);
});

test('says a session file overrides a global write', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'launch-limit');

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(join(dataDir, 'sessions', 's1.launch-limit'), '5\n');

  const run = runLimit([dataDir, 's1', '90', '--global'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), '90\n');
  assert.equal(run.stdout, `wrote ${ path }; this session's launch limit is 5 (session)\n`);
});

test('names the file when the limit in force is invalid', (t) => {
  const dataDir = makeTempDir(t);
  const bad = join(dataDir, 'sessions', 's1.launch-limit');
  const path = join(dataDir, 'launch-limit');

  mkdirSync(join(dataDir, 'sessions'));
  writeFileSync(bad, 'many\n');

  const run = runLimit([dataDir, 's1', '9', '--global'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), '9\n');
  assert.equal(
    run.stdout,
    `wrote ${ path }; ${ bad } holds no whole number, so launches are refused\n`,
  );
});

test('writes the largest safe integer and the gate reads it back', (t) => {
  const dataDir = makeTempDir(t);
  const path = join(dataDir, 'sessions', 's1.launch-limit');
  const run = runLimit([dataDir, 's1', '9007199254740991'], makeTempDir(t));

  assert.equal(run.status, 0);
  assert.equal(readFileSync(path, 'utf8'), '9007199254740991\n');
  assert.deepEqual(readLimit(dataDir, 's1'), {
    kind: 'value',
    value: Number.MAX_SAFE_INTEGER,
    source: 'session',
    path,
  });
});

test('does not touch another session', (t) => {
  const dataDir = makeTempDir(t);

  runLimit([dataDir, 's1', '3'], makeTempDir(t));

  assert.deepEqual(readdirSync(join(dataDir, 'sessions')), ['s1.launch-limit']);
});

test('runs through run.sh', (t) => {
  const dataDir = makeTempDir(t);
  const run = spawnSync(
    'bash',
    [RUN_SH, 'claude/providens/limit', dataDir, 's1', '12'],
    { cwd: makeTempDir(t), encoding: 'utf8', timeout: SUBPROCESS_TIMEOUT_MS },
  );

  assert.deepEqual([run.status, run.stderr], [0, '']);
  assert.equal(readFileSync(join(dataDir, 'sessions', 's1.launch-limit'), 'utf8'), '12\n');
  assert.match(run.stdout, /^wrote [^\n]*; this session's launch limit is 12 \(session\)\n$/u);
});

for (const [name, args] of [
  ['an empty data dir', ['', 's1', '5']],
  ['an unsafe id', ['DIR', '../s1', '5']],
  ['an empty id', ['DIR', '', '5']],
  ['no value', ['DIR', 's1']],
  ['only --global', ['DIR', 's1', '--global']],
  ['two values', ['DIR', 's1', '5', '6']],
  ['a number with a suffix', ['DIR', 's1', '6x']],
  ['a negative number', ['DIR', 's1', '-1']],
  ['a decimal', ['DIR', 's1', '1.5']],
  ['a number past the safe range', ['DIR', 's1', '9007199254740992']],
  ['a number that prints in exponent form', ['DIR', 's1', '1000000000000000000000']],
  ['--global twice', ['DIR', 's1', '5', '--global', '--global']],
  ['an unknown flag', ['DIR', 's1', '5', '--force']],
] as const) {
  test(`refuses ${ name } with one usage line, exit 2 and nothing written`, (t) => {
    const dataDir = makeTempDir(t);
    const cwd = makeTempDir(t);
    const run = runLimit(args.map((arg) => (arg === 'DIR' ? dataDir : arg)), cwd);

    assert.equal(run.status, 2);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /^yapus providens limit: usage: [^\n]*\n$/u);
    assert.deepEqual(readdirSync(dataDir), []);
    assert.deepEqual(readdirSync(cwd), []);
  });
}

function runLimit(args: readonly string[], cwd: string) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
