import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  admitLaunch,
  countLaunches,
} from '../../../../../hooks/claude/tyler/launch/admit-launch.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('admits a launch and counts it in the session log', (t) => {
  const dataDir = makeTempDir(t);

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
});

test('refuses the launch past the default limit of 41', (t) => {
  const dataDir = makeSessionLog(t, 41);

  assert.equal(
    admitLaunch(dataDir, 's1'),
    'this session has launched 41 subagents, its limit; the person can raise it by '
      + `writing a larger number into ${ join(dataDir, 'launch-limit') }`,
  );
});

test('takes the limit the person wrote', (t) => {
  const dataDir = makeSessionLog(t, 41);

  writeFileSync(join(dataDir, 'launch-limit'), '42\n');

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
});

test('refuses on a limit file that holds no whole number', (t) => {
  const dataDir = makeTempDir(t);
  const limitPath = join(dataDir, 'launch-limit');

  writeFileSync(limitPath, 'many\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    `${ limitPath } holds no whole number; the person writes one there, such as 41`,
  );
});

test('takes the session limit over the global one', (t) => {
  const dataDir = makeSessionLog(t, 5);

  writeSessionLimit(dataDir, 's1', '5\n');
  writeFileSync(join(dataDir, 'launch-limit'), '99\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    'this session has launched 5 subagents, its limit; the person can raise it by '
      + `writing a larger number into ${ join(dataDir, 'sessions', 's1.launch-limit') }`,
  );
});

test('leaves another session on the global limit', (t) => {
  const dataDir = makeSessionLog(t, 5);

  writeSessionLimit(dataDir, 's1', '5\n');
  writeFileSync(join(dataDir, 'launch-limit'), '6\n');
  mkdirSync(join(dataDir, 'launches'), { recursive: true });
  writeFileSync(join(dataDir, 'launches', 's2.log'), '+\n'.repeat(5));

  assert.equal(admitLaunch(dataDir, 's2'), undefined);
});

test('refuses on a session limit file that holds no whole number', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'launch-limit'), '99\n');
  writeSessionLimit(dataDir, 's1', 'many\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    `${ join(dataDir, 'sessions', 's1.launch-limit') } holds no whole number; `
      + 'the person writes one there, such as 41',
  );
});

test('refuses on a global limit file with no whole number when the session has none', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'launch-limit'), 'many\n');
  writeSessionLimit(dataDir, 's2', '3\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    `${ join(dataDir, 'launch-limit') } holds no whole number; `
      + 'the person writes one there, such as 41',
  );
});

test('admits the 41st launch when no limit file exists', (t) => {
  const dataDir = makeSessionLog(t, 40);

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
  assert.equal(countLaunches(dataDir, 's1'), 41);
});

test('counts only the launches of the given session', (t) => {
  const dataDir = makeSessionLog(t, 3);

  writeFileSync(join(dataDir, 'launches', 's2.log'), '+\n'.repeat(7));

  assert.equal(countLaunches(dataDir, 's1'), 3);
  assert.equal(countLaunches(dataDir, 's3'), 0);
});

function writeSessionLimit(dataDir: string, sessionId: string, text: string): void {
  mkdirSync(join(dataDir, 'sessions'), { recursive: true });
  writeFileSync(join(dataDir, 'sessions', `${ sessionId }.launch-limit`), text);
}

function makeSessionLog(t: TestContext, launches: number): string {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'launches'));
  writeFileSync(join(dataDir, 'launches', 's1.log'), '+\n'.repeat(launches));

  return dataDir;
}
