import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../helpers/run-git.ts';
import { CLEAN_ANSWER, makeFakeScanner } from '../../helpers/scanner/make-fake-scanner.ts';
import { withScanner } from '../../helpers/scanner/with-scanner.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', 'hooks', 'git');
const SUBPROCESS_TIMEOUT_MS = 60000;
// Writes a valid subject above the template git hands the editor.
const EDITOR_SCRIPT =
  'printf "feat(hooks): add a check\\n" | cat - "$1" > "$1.new" && mv "$1.new" "$1"\n';

interface GitRun {
  readonly repository: string;
  readonly args: readonly string[];
  readonly extraEnv?: NodeJS.ProcessEnv;
}

test('refuses a commit whose verb is not in the catalog', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', 'fix(hooks): fixed it'],
  });

  assert.equal(commitRun.status, 1);
  assert.match(commitRun.stderr, /^yapus subject: verb "fixed" is not in \S+verbs\.json; /m);
});

test('lets a commit through whose subject keeps the rule', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', 'feat(hooks): add a check'],
  });

  assert.deepEqual([commitRun.status, commitRun.stderr], [0, '']);
});

test('lets a commit through that an editor wrote with git commit -v', (t) => {
  const repository = makeHookedRepo(t);
  const editor = join(makeTempDir(t), 'editor.sh');

  writeFileSync(editor, EDITOR_SCRIPT);

  const commitRun = runRealGit(t, {
    repository,
    args: ['commit', '--allow-empty', '-v'],
    extraEnv: { GIT_EDITOR: `sh ${ editor }` },
  });

  assert.deepEqual([commitRun.status, commitRun.stderr], [0, '']);
});

test('refuses a commit from a file whose second line is not blank', (t) => {
  const repository = makeHookedRepo(t);
  const messagePath = join(makeTempDir(t), 'message');

  writeFileSync(messagePath, 'feat(hooks): add a check\nThe body.\n');

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-F', messagePath],
  });

  assert.deepEqual(
    [commitRun.status, commitRun.stderr],
    [
      1,
      'yapus subject: the line after the subject is not blank; leave it empty before the body\n',
    ],
  );
});

// A temporary repository whose git runs the hooks of this repository.
function makeHookedRepo(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return repository;
}

// Git runs with a clean fake scanner first on PATH, so that the scan hooks
// say nothing whether or not the machine has one.
function runRealGit(t: TestContext, { repository, args, extraEnv = {} }: GitRun) {
  const baseEnv = withScanner(getGitEnv(process.env), makeFakeScanner(t, CLEAN_ANSWER));

  return spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...baseEnv, HOME: makeTempDir(t), TMPDIR: makeTempDir(t), ...extraEnv },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
