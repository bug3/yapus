import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { makeTempDir } from './make-temp-dir.ts';
import { makeTempRepo } from './make-temp-repo.ts';
import { getGitEnv } from './run-git.ts';

const RUN_GIT_URL = pathToFileURL(join(import.meta.dirname, 'run-git.ts')).href;
const SUBPROCESS_TIMEOUT_MS = 10000;
const LIST_UNTRACKED = `
  const { runGit } = await import(process.argv[1]);
  process.stdout.write(runGit(['ls-files', '--others', '--exclude-standard'], process.argv[2]));
`;

test('drops the git variables and isolates the git config', () => {
  const env = getGitEnv({
    GIT_DIR: '/outer/.git',
    GIT_INDEX_FILE: '/outer/.git/index',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.excludesFile',
    PATH: '/usr/bin',
  });

  assert.deepEqual(env, {
    PATH: '/usr/bin',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    XDG_CONFIG_HOME: '/dev/null',
  });
});

test('drops CLAUDECODE', () => {
  const env = getGitEnv({ CLAUDECODE: '1', PATH: '/usr/bin' });

  assert.equal('CLAUDECODE' in env, false);
});

test('lists the repository in cwd whatever git variables and config the caller has', (t) => {
  const repoA = makeTempRepo(t);
  const repoB = makeTempRepo(t);
  const home = makeTempDir(t);
  const xdgConfigHome = makeTempDir(t);
  const excludes = join(home, 'excludes');
  const globalConfig = join(home, '.gitconfig');

  writeFileSync(join(repoA, 'ignored.md'), '');
  writeFileSync(join(repoA, 'kept.md'), '');
  writeFileSync(join(repoB, '.git', 'info', 'exclude'), 'kept.md\n');
  writeFileSync(excludes, 'ignored.md\n');
  writeFileSync(globalConfig, `[core]\n\texcludesFile = ${ excludes }\n`);
  mkdirSync(join(xdgConfigHome, 'git'));
  writeFileSync(join(xdgConfigHome, 'git', 'ignore'), 'ignored.md\n');

  const listing = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', LIST_UNTRACKED, RUN_GIT_URL, repoA],
    {
      encoding: 'utf8',
      timeout: SUBPROCESS_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME: home,
        GIT_DIR: join(repoB, '.git'),
        GIT_CONFIG_GLOBAL: globalConfig,
        XDG_CONFIG_HOME: xdgConfigHome,
      },
    },
  );

  assert.equal(listing, 'ignored.md\nkept.md\n');
});
