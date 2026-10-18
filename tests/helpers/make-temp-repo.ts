import type { TestContext } from 'node:test';
import { makeTempDir } from './make-temp-dir.ts';
import { runGit } from './run-git.ts';

const IDENTITY_NAME = 'yapus test';
const IDENTITY_EMAIL = 'test@example.invalid';

// A fresh temporary directory holding an empty git repository with a local
// identity, removed when the test ends.
export function makeTempRepo(t: TestContext): string {
  const tempRepo = makeTempDir(t);

  runGit(['init', '--quiet'], tempRepo);
  runGit(['config', 'user.name', IDENTITY_NAME], tempRepo);
  runGit(['config', 'user.email', IDENTITY_EMAIL], tempRepo);

  return tempRepo;
}
