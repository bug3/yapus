import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { runGit } from '../../../../helpers/run-git.ts';

// A fresh temporary git repository whose HEAD is one commit holding a.txt,
// removed when the test ends.
export function makeCommittedRepo(t: TestContext): string {
  const repo = makeTempRepo(t);

  writeFileSync(join(repo, 'a.txt'), 'a\n');
  runGit(['add', '-A'], repo);
  runGit(['commit', '--quiet', '-m', 'test(fixture): add file'], repo);

  return repo;
}
