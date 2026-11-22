import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { getExclusionPath } from '../../../../hooks/shared/exclusion/get-exclusion-path.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv } from '../../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const MAIN = join(ROOT, 'hooks', 'git', 'trailer', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 10000;
const MESSAGE = 'feat(hooks): add a check\n';

test('exits 2 with one line for a missing message file', (t) => {
  const tempDir = makeTempDir(t);

  const hookRun = spawnSync(process.execPath, [MAIN, 'missing'], {
    cwd: tempDir,
    encoding: 'utf8',
    // git words its fatal line in the C locale; HOME keeps the machine's
    // exclusion list out.
    env: { ...getGitEnv(process.env), HOME: tempDir, LC_ALL: 'C' },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [
      2,
      '',
      "yapus trailer: git interpret-trailers failed: exit 128: fatal: could not read input file 'missing': No such file or directory; the commit is blocked, fix the hook\n",
    ],
  );
});

test('leaves the message as it is in a listed repository', (t) => {
  const repository = makeTempRepo(t);
  const home = makeTempDir(t);
  const listPath = getExclusionPath(home);
  const messageFile = join(home, 'COMMIT_EDITMSG');

  mkdirSync(dirname(listPath), { recursive: true });
  writeFileSync(listPath, `${ JSON.stringify([realpathSync(repository)]) }\n`);
  writeFileSync(messageFile, MESSAGE);

  const hookRun = spawnSync(process.execPath, [MAIN, messageFile], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: home },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr, readFileSync(messageFile, 'utf8')],
    [0, '', '', MESSAGE],
  );
});
