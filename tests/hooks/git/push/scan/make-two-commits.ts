import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { runGit } from '../../../../helpers/run-git.ts';
import { makeNpmRepo, PASSING_TEST } from '../make-npm-repo.ts';

export interface TwoCommits {
  readonly repository: string;
  readonly first: string;
  readonly second: string;
}

// A temporary repository with two commits, the second on top of the first.
export function makeTwoCommits(t: TestContext): TwoCommits {
  const { repository, sha: first } = makeNpmRepo(t, PASSING_TEST);

  writeFileSync(join(repository, 'b.md'), 'b\n');
  runGit(['add', 'b.md'], repository);
  runGit(['commit', '--quiet', '--message', 'add b'], repository);

  return { repository, first, second: runGit(['rev-parse', 'HEAD'], repository).trim() };
}
