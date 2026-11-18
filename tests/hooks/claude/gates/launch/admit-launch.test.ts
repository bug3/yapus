import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  admitLaunch,
  countLaunches,
} from '../../../../../hooks/claude/gates/launch/admit-launch.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

test('admits a launch and counts it in the session log', (t) => {
  const dataDir = makeTempDir(t);

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
  assert.equal(readFileSync(join(dataDir, 'launches', 's1.log'), 'utf8'), '+\n');
});

test('refuses the launch past the default limit of 60', (t) => {
  const dataDir = makeSessionLog(t, 60);

  assert.equal(
    admitLaunch(dataDir, 's1'),
    'this session has launched 60 subagents and its limit is 60; the person can raise it '
      + 'with /delegator:agent-limit <n>',
  );
});

test('states the count and the limit when the count is past the limit', (t) => {
  const dataDir = makeSessionLog(t, 7);

  writeFileSync(join(dataDir, 'launch-limit'), '5\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    'this session has launched 7 subagents and its limit is 5; the person can raise it '
      + 'with /delegator:agent-limit <n>',
  );
});

test('takes the limit the person wrote', (t) => {
  const dataDir = makeSessionLog(t, 60);

  writeFileSync(join(dataDir, 'launch-limit'), '61\n');

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
});

test('refuses on a limit file that holds no whole number', (t) => {
  const dataDir = makeTempDir(t);
  const limitPath = join(dataDir, 'launch-limit');

  writeFileSync(limitPath, 'many\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    `${ limitPath } holds no whole number; the person writes one there, such as 60`,
  );
});

test('takes the session limit over the global one', (t) => {
  const dataDir = makeSessionLog(t, 5);

  writeSessionLimit(dataDir, 's1', '5\n');
  writeFileSync(join(dataDir, 'launch-limit'), '99\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    'this session has launched 5 subagents and its limit is 5; the person can raise it '
      + 'with /delegator:agent-limit <n>',
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
      + 'the person writes one there, such as 60',
  );
});

test('refuses on a global limit file with no whole number when the session has none', (t) => {
  const dataDir = makeTempDir(t);

  writeFileSync(join(dataDir, 'launch-limit'), 'many\n');
  writeSessionLimit(dataDir, 's2', '3\n');

  assert.equal(
    admitLaunch(dataDir, 's1'),
    `${ join(dataDir, 'launch-limit') } holds no whole number; `
      + 'the person writes one there, such as 60',
  );
});

test('admits the 60th launch when no limit file exists', (t) => {
  const dataDir = makeSessionLog(t, 59);

  assert.equal(admitLaunch(dataDir, 's1'), undefined);
  assert.equal(countLaunches(dataDir, 's1'), 60);
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
