import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { getGitEnv, runGit } from '../../../../../helpers/run-git.ts';
import { makeTempRepo } from '../../../../../helpers/make-temp-repo.ts';

// FIRST_TIME precedes START_TIME; SECOND_TIME and LATER_TIME follow it.
export const FIRST_TIME = '2023-11-14T22:13:20+0000';

export const START_TIME = new Date('2023-11-14T22:13:30Z');

export const SECOND_TIME = '2023-11-14T22:13:40+0000';

export const LATER_TIME = '2023-11-14T22:13:50+0000';

// git run with the committer date fixed, so reflog times are known.
export function runGitAt(args: readonly string[], cwd: string, time: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), GIT_COMMITTER_DATE: time, GIT_AUTHOR_DATE: time },
  });
}

// Commits a new file in the repository at the given time; returns the commit id.
export function commitAt(repo: string, name: string, time: string): string {
  writeFileSync(join(repo, name), `${ name }\n`);
  runGit(['add', '-A'], repo);
  runGitAt(['commit', '--quiet', '-m', 'test(fixture): add file'], repo, time);

  return runGit(['rev-parse', 'HEAD'], repo).trim();
}

// A temporary repository whose only commit, `first`, was made at FIRST_TIME.
export function makeDatedRepo(t: TestContext): { repo: string; first: string } {
  const repo = makeTempRepo(t);

  return { repo, first: commitAt(repo, 'a.txt', FIRST_TIME) };
}
