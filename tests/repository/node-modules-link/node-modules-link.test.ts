import assert from 'node:assert/strict';
import { copyFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { runGit } from '../../helpers/run-git.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

// The push test links node_modules into its worktree as a symlink, which a
// pattern for directories only does not ignore.
test('ignores a node_modules that is a symlink', (t) => {
  const repository = makeTempRepo(t);

  copyFileSync(join(ROOT, '.gitignore'), join(repository, '.gitignore'));
  symlinkSync(makeTempDir(t), join(repository, 'node_modules'));

  assert.equal(
    runGit(['ls-files', '--others', '--exclude-standard'], repository),
    '.gitignore\n',
  );
});
