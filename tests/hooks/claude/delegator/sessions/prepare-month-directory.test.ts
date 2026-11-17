import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  prepareMonthDirectory,
} from '../../../../../hooks/claude/delegator/sessions/prepare-month-directory.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const MONTH = '2026-11';

test('creates the sessions and month directories private, .yapus with the default mode', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');
  const defaultDirectory = join(projectRoot, 'default');

  mkdirSync(defaultDirectory);
  prepareMonthDirectory(projectRoot, MONTH);

  assert.deepEqual(
    [
      getMode(join(projectRoot, '.yapus')),
      getMode(sessionsDirectory),
      getMode(join(sessionsDirectory, MONTH)),
    ],
    [getMode(defaultDirectory), 0o700, 0o700],
  );
});

test('writes the ignore file into the sessions directory alone', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  prepareMonthDirectory(projectRoot, MONTH);

  assert.deepEqual(
    [
      readFileSync(join(sessionsDirectory, '.gitignore'), 'utf8'),
      existsSync(join(sessionsDirectory, MONTH, '.gitignore')),
      existsSync(join(projectRoot, '.yapus', '.gitignore')),
    ],
    ['*\n', false, false],
  );
});

test('adds a month directory private to an existing sessions directory', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  prepareMonthDirectory(projectRoot, MONTH);
  prepareMonthDirectory(projectRoot, '2026-12');

  assert.deepEqual(
    [getMode(join(sessionsDirectory, MONTH)), getMode(join(sessionsDirectory, '2026-12'))],
    [0o700, 0o700],
  );
});

test('leaves existing directories and an existing ignore file as they are', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');
  const monthDirectory = join(sessionsDirectory, MONTH);
  const ignorePath = join(sessionsDirectory, '.gitignore');

  mkdirSync(monthDirectory, { recursive: true });
  writeFileSync(ignorePath, '!*.jsonl');
  chmodSync(sessionsDirectory, 0o755);
  chmodSync(monthDirectory, 0o755);
  prepareMonthDirectory(projectRoot, MONTH);

  assert.deepEqual(
    [getMode(sessionsDirectory), getMode(monthDirectory), readFileSync(ignorePath, 'utf8')],
    [0o755, 0o755, '!*.jsonl'],
  );
});

test('writes the ignore file into an existing sessions directory that has none', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  mkdirSync(join(sessionsDirectory, MONTH), { recursive: true });
  prepareMonthDirectory(projectRoot, MONTH);

  assert.equal(readFileSync(join(sessionsDirectory, '.gitignore'), 'utf8'), '*\n');
});

test('throws and leaves the file when .yapus is a file', (t) => {
  const projectRoot = makeTempDir(t);

  writeFileSync(join(projectRoot, '.yapus'), 'a file where the directory goes');

  assert.throws(() => {
    prepareMonthDirectory(projectRoot, MONTH);
  });
  assert.equal(statSync(join(projectRoot, '.yapus')).isFile(), true);
});

function getMode(path: string): number {
  return statSync(path).mode & 0o777;
}
