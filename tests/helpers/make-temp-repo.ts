import { execFileSync } from 'node:child_process';
import type { TestContext } from 'node:test';
import { makeTempDir } from './make-temp-dir.ts';

// A fresh temporary directory holding an empty git repository, removed
// when the test ends.
export function makeTempRepo(t: TestContext): string {
  const tempRepo = makeTempDir(t);

  execFileSync('git', ['init', '--quiet'], { cwd: tempRepo, stdio: 'ignore' });

  return tempRepo;
}
