import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../helpers/run-git.ts';
import { FAILING_TEST, makeNpmRepo, PASSING_TEST } from './push/make-npm-repo.ts';

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

test('lets a push through when npm test passes on its commit', (t) => {
  const { repository } = makeNpmRepo(t, PASSING_TEST);
  const tempParent = makeTempDir(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  const pushRun = runPush(t, repository, tempParent);

  assert.deepEqual([pushRun.status, readdirSync(tempParent)], [0, []]);
});

test('refuses a push when npm test fails on its commit', (t) => {
  const { repository, sha } = makeNpmRepo(t, FAILING_TEST);
  const tempParent = makeTempDir(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  const pushRun = runPush(t, repository, tempParent);

  assert.equal(pushRun.status, 1);
  assert.ok(pushRun.stderr.includes(
    `yapus push: npm test failed on ${ sha.slice(0, 12) }; fix it, then push again\n`,
  ));
  assert.deepEqual(readdirSync(tempParent), []);
});

// A temporary repository whose git runs the hooks of this repository.
function makeHookedRepo(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return repository;
}

// A push to a bare repository in the test's directory. npm keeps a compile
// cache in TMPDIR, which the test checks is left empty, so the cache is off.
function runPush(t: TestContext, repository: string, tempParent: string) {
  const remote = makeTempDir(t);

  runGit(['init', '--bare', '--quiet'], remote);

  return runRealGit(t, {
    repository,
    args: ['push', '--quiet', remote, 'HEAD:refs/heads/main'],
    extraEnv: {
      TMPDIR: tempParent,
      NODE_DISABLE_COMPILE_CACHE: '1',
      npm_config_update_notifier: 'false',
    },
  });
}

function runRealGit(t: TestContext, { repository, args, extraEnv = {} }: GitRun) {
  return spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: makeTempDir(t), ...extraEnv },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
