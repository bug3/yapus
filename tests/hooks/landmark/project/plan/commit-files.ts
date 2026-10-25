import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runGit } from '../../../../helpers/run-git.ts';

// Writes each file under repo and commits them all in one commit.
export function commitFiles(repo: string, files: readonly (readonly [string, string])[]): void {
  writeFiles(repo, files);
  runGit(['add', '--all'], repo);
  runGit(['commit', '--quiet', '--message', 'test'], repo);
}

// Writes each file under repo without committing.
export function writeFiles(repo: string, files: readonly (readonly [string, string])[]): void {
  for (const [path, text] of files) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
}
