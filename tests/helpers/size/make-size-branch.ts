import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';
import { makeTempRepo } from '../make-temp-repo.ts';
import { runGit } from '../run-git.ts';

function lines(count: number): string {
  return 'line\n'.repeat(count);
}

// A repository on main with a .gitattributes that marks gen/** generated, pushed to a
// bare origin whose HEAD is main, then on the branch feat/size, which adds 450 lines in
// src/big.ts, 3 in a file with a tab in its name, 1 in .gitattributes (which also marks
// own/** generated) and 2 in own/x.txt (456 lines that count), and a lockfile and a
// generated file of 5000 lines each and a binary file (which do not). The branch is
// pushed with its upstream set. Removed when the test ends.
export function makeSizeBranch(t: TestContext): string {
  const origin = makeTempDir(t);
  const repo = makeTempRepo(t);

  runGit(['init', '--bare', '--quiet', '-b', 'main'], origin);
  runGit(['checkout', '--quiet', '-b', 'main'], repo);
  writeFileSync(join(repo, 'README.md'), 'readme\n');
  writeFileSync(join(repo, '.gitattributes'), 'gen/** linguist-generated\n');
  runGit(['add', '.'], repo);
  runGit(['commit', '--quiet', '-m', 'base'], repo);
  runGit(['remote', 'add', 'origin', origin], repo);
  runGit(['push', '--quiet', 'origin', 'main'], repo);
  runGit(['fetch', '--quiet', 'origin'], repo);
  runGit(['remote', 'set-head', 'origin', 'main'], repo);
  runGit(['checkout', '--quiet', '-b', 'feat/size'], repo);
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'gen'));
  mkdirSync(join(repo, 'own'));
  appendFileSync(join(repo, '.gitattributes'), 'own/** linguist-generated\n');
  writeFileSync(join(repo, 'own', 'x.txt'), lines(2));
  writeFileSync(join(repo, 'src', 'big.ts'), lines(450));
  writeFileSync(join(repo, 'src', 'tab\tname.ts'), lines(3));
  writeFileSync(join(repo, 'package-lock.json'), lines(5000));
  writeFileSync(join(repo, 'gen', 'out.js'), lines(5000));
  writeFileSync(join(repo, 'image.bin'), Buffer.from([0, 1, 2, 0, 255]));
  runGit(['add', '.'], repo);
  runGit(['commit', '--quiet', '-m', 'change'], repo);
  runGit(['push', '--quiet', '--set-upstream', 'origin', 'feat/size'], repo);

  return repo;
}
