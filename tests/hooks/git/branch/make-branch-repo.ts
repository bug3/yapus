import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';
import { CLEAN_ANSWER, makeFakeScanner } from '../../../helpers/scanner/make-fake-scanner.ts';
import { withScanner } from '../../../helpers/scanner/with-scanner.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git');
const SUBPROCESS_TIMEOUT_MS = 60000;
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
const PERSON: NodeJS.ProcessEnv = {};

// A repository on main with no commit and the hooks of this repository as its
// hooks.
export function makeUnbornRepo(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['symbolic-ref', 'HEAD', 'refs/heads/main'], repository);
  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return repository;
}

// A repository on main with one commit, made before the hooks are set, and
// the hooks of this repository as its hooks.
export function makeBranchRepo(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['symbolic-ref', 'HEAD', 'refs/heads/main'], repository);
  runGit(['commit', '--quiet', '--allow-empty', '-m', 'feat(hooks): add a check'], repository);
  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return repository;
}

// A real git command through the hooks, as an agent.
export function runAgentGit(
  t: TestContext,
  repository: string,
  args: readonly string[],
): SpawnSyncReturns<string> {
  return runHookedGit(t, { repository, args, who: AGENT });
}

// A real git command through the hooks, as a person.
export function runPersonGit(
  t: TestContext,
  repository: string,
  args: readonly string[],
): SpawnSyncReturns<string> {
  return runHookedGit(t, { repository, args, who: PERSON });
}

// Whether the ref exists in the repository.
export function hasRef(repository: string, ref: string): boolean {
  const revParseRun = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
    cwd: repository,
    encoding: 'utf8',
    env: getGitEnv(process.env),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return revParseRun.status === 0;
}

interface HookedGitRun {
  readonly repository: string;
  readonly args: readonly string[];
  readonly who: NodeJS.ProcessEnv;
}

// Git runs with a clean fake scanner first on PATH, so that the commit hooks
// say nothing whether or not the machine has one.
function runHookedGit(
  t: TestContext,
  { repository, args, who }: HookedGitRun,
): SpawnSyncReturns<string> {
  const baseEnv = withScanner(getGitEnv(process.env), makeFakeScanner(t, CLEAN_ANSWER));

  return spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: makeTempDir(t), TMPDIR: makeTempDir(t), ...who },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
