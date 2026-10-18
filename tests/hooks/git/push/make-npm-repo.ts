import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { runGit } from '../../../helpers/run-git.ts';

export interface NpmRepo {
  readonly repository: string;
  readonly sha: string;
}

// A temporary repository whose one commit holds a package.json with a test
// script that exits with testExitCode, beside an empty node_modules as npm ci
// would leave it.
export function makeNpmRepo(t: TestContext, testExitCode: number): NpmRepo {
  const repository = makeTempRepo(t);
  const testScript = `node -e "process.exit(${ String(testExitCode) })"`;
  const packageText = JSON.stringify({ scripts: { test: testScript } });

  writeFileSync(join(repository, 'package.json'), `${ packageText }\n`);
  mkdirSync(join(repository, 'node_modules'));
  runGit(['add', 'package.json'], repository);
  runGit(['commit', '--quiet', '--message', 'add package.json'], repository);

  return { repository, sha: runGit(['rev-parse', 'HEAD'], repository).trim() };
}
