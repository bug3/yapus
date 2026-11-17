import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  findSessionFile,
} from '../../../../../hooks/claude/delegator/sessions/find-session-file.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const NAME = '15T10-00-00Z_s1.jsonl';

test('finds the file of the session in its month directory', (t) => {
  const projectRoot = makeTempDir(t);
  const path = writeSessionFile(projectRoot, '2026-11', NAME);

  assert.deepEqual(findSessionFile(projectRoot, 's1'), { kind: 'file', path });
});

test('finds nothing without a sessions directory or in an empty one', (t) => {
  const projectRoot = makeTempDir(t);
  const emptyRoot = makeTempDir(t);

  mkdirSync(join(emptyRoot, '.yapus', 'sessions'), { recursive: true });

  assert.deepEqual(
    [findSessionFile(projectRoot, 's1'), findSessionFile(emptyRoot, 's1')],
    [{ kind: 'missing' }, { kind: 'missing' }],
  );
});

test('finds nothing among the files of other sessions', (t) => {
  const projectRoot = makeTempDir(t);

  writeSessionFile(projectRoot, '2026-11', '15T10-00-00Z_s2.jsonl');
  writeSessionFile(projectRoot, '2026-11', '15T10-00-00Z_a-s1.jsonl');
  writeSessionFile(projectRoot, '2026-11', '15T10-00-00Z_s1.jsonl.bak');

  assert.deepEqual(findSessionFile(projectRoot, 's1'), { kind: 'missing' });
});

test('reads the month directories newest first and stops at the first file', (t) => {
  const projectRoot = makeTempDir(t);

  writeSessionFile(projectRoot, '2026-02', NAME);
  writeSessionFile(projectRoot, '2025-12', NAME);

  const path = writeSessionFile(projectRoot, '2026-11', NAME);

  assert.deepEqual(findSessionFile(projectRoot, 's1'), { kind: 'file', path });
});

test('finds the file in an older month when the newer ones hold other sessions', (t) => {
  const projectRoot = makeTempDir(t);
  const path = writeSessionFile(projectRoot, '2026-10', NAME);

  writeSessionFile(projectRoot, '2026-11', '01T08-00-00Z_s2.jsonl');

  assert.deepEqual(findSessionFile(projectRoot, 's1'), { kind: 'file', path });
});

test('reads no entry of the sessions directory that is not a month directory', (t) => {
  const projectRoot = makeTempDir(t);
  const sessionsDirectory = join(projectRoot, '.yapus', 'sessions');

  writeSessionFile(projectRoot, 'backup', NAME);
  writeSessionFile(projectRoot, '2026-13', NAME);
  writeFileSync(join(sessionsDirectory, '.gitignore'), '*\n');
  writeFileSync(join(sessionsDirectory, '2026-12'), 'a file named as a month');
  writeFileSync(join(sessionsDirectory, NAME), '');

  assert.deepEqual(findSessionFile(projectRoot, 's1'), { kind: 'missing' });
});

test('fails with the path when the sessions directory cannot be read', (t) => {
  const projectRoot = makeTempDir(t);

  mkdirSync(join(projectRoot, '.yapus'));
  writeFileSync(join(projectRoot, '.yapus', 'sessions'), 'a file where the directory goes');

  assert.match(
    JSON.stringify(findSessionFile(projectRoot, 's1')),
    /^\{"kind":"failure","detail":"cannot read .*\/\.yapus\/sessions: ENOTDIR.*"\}$/u,
  );
});

test('fails with the path when a month directory cannot be read', (t) => {
  const projectRoot = makeTempDir(t);
  const monthDirectory = dirname(writeSessionFile(projectRoot, '2026-11', NAME));

  chmodSync(monthDirectory, 0o000);

  const found = findSessionFile(projectRoot, 's1');

  // Given back before the test ends, so the temporary directory can be removed.
  chmodSync(monthDirectory, 0o700);

  assert.match(
    JSON.stringify(found),
    /^\{"kind":"failure","detail":"cannot read .*\/sessions\/2026-11: EACCES.*"\}$/u,
  );
});

// An empty file of that name in the month directory; its path.
function writeSessionFile(projectRoot: string, month: string, name: string): string {
  const monthDirectory = join(projectRoot, '.yapus', 'sessions', month);

  mkdirSync(monthDirectory, { recursive: true });
  writeFileSync(join(monthDirectory, name), '');

  return join(monthDirectory, name);
}
