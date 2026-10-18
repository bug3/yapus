import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { admitLaunch } from '../../../../../hooks/claude/tyler/launch/admit-launch.ts';
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

function makeSessionLog(t: TestContext, launches: number): string {
  const dataDir = makeTempDir(t);

  mkdirSync(join(dataDir, 'launches'));
  writeFileSync(join(dataDir, 'launches', 's1.log'), '+\n'.repeat(launches));

  return dataDir;
}
