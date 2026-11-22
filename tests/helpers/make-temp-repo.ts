import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

export interface TempFile {
  readonly path: string;
  readonly text: string;
}

// A fresh temporary git repository holding each file at its path relative
// to the root, with its directories, removed when the test ends.
export function makeTempFiles(t: TestContext, files: readonly TempFile[]): string {
  const root = makeTempRepo(t);

  for (const { path, text } of files) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
}
