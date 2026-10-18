import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { runGit } from '../../../helpers/run-git.ts';

export const PASSING_TEST = 'node -e "process.exit(0)"';

export const FAILING_TEST = 'node -e "process.exit(1)"';

// Fails when a variable that ties git to an outer repository reaches npm test.
export const CLEAN_ENV_TEST =
  'node -e "process.exit(process.env.GIT_DIR || process.env.GIT_INDEX_FILE ? 1 : 0)"';

export interface NpmRepo {
  readonly repository: string;
  readonly sha: string;
}

// A temporary repository whose one commit holds a package.json with the
// given test script, beside an empty node_modules as npm ci would leave it.
export function makeNpmRepo(t: TestContext, testScript: string): NpmRepo {
  const repository = makeTempRepo(t);
  const packageText = JSON.stringify({ scripts: { test: testScript } });

  writeFileSync(join(repository, 'package.json'), `${ packageText }\n`);
  mkdirSync(join(repository, 'node_modules'));
  runGit(['add', 'package.json'], repository);
  runGit(['commit', '--quiet', '--message', 'add package.json'], repository);

  return { repository, sha: runGit(['rev-parse', 'HEAD'], repository).trim() };
}
