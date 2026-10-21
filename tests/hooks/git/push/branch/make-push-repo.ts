import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { getGitEnv, runGit } from '../../../../helpers/run-git.ts';
import { makeNpmRepo, PASSING_TEST } from '../make-npm-repo.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks', 'git');
const SUBPROCESS_TIMEOUT_MS = 60000;
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
const PERSON: NodeJS.ProcessEnv = {};

export interface PushRepo {
  readonly repository: string;
  // The bare repository that origin names.
  readonly remote: string;
}

// A repository with one commit whose npm test passes, a bare remote named
// origin, and the hooks of this repository as its hooks.
export function makePushRepo(t: TestContext): PushRepo {
  const { repository } = makeNpmRepo(t, PASSING_TEST);
  const remote = makeTempDir(t);

  runGit(['init', '--bare', '--quiet'], remote);
  runGit(['remote', 'add', 'origin', remote], repository);
  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return { repository, remote };
}

// A real git push through the hook, as an agent.
export function runAgentPush(
  t: TestContext,
  repository: string,
  args: readonly string[],
): SpawnSyncReturns<string> {
  return runPush(t, { repository, args, who: AGENT });
}

// A real git push through the hook, as a person.
export function runPersonPush(
  t: TestContext,
  repository: string,
  args: readonly string[],
): SpawnSyncReturns<string> {
  return runPush(t, { repository, args, who: PERSON });
}

interface PushRun {
  readonly repository: string;
  readonly args: readonly string[];
  readonly who: NodeJS.ProcessEnv;
}

function runPush(t: TestContext, { repository, args, who }: PushRun): SpawnSyncReturns<string> {
  return spawnSync('git', ['push', '--quiet', ...args], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      ...getGitEnv(process.env),
      HOME: makeTempDir(t),
      TMPDIR: makeTempDir(t),
      NODE_DISABLE_COMPILE_CACHE: '1',
      npm_config_update_notifier: 'false',
      ...who,
    },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
