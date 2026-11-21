import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';
import { getGitEnv, runGit } from '../../../helpers/run-git.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git');
const SUBPROCESS_TIMEOUT_MS = 60000;
const AGENT: NodeJS.ProcessEnv = { CLAUDECODE: '1' };
const HUMAN: NodeJS.ProcessEnv = {};
const SUBJECT = 'feat(hooks): add x';
const TRAILERS = 'Assisted-by: Claude Code\nCo-authored-by: yapus <noreply@yapus.dev>\n';
// Writes a valid subject above the template git hands the editor.
const EDITOR_SCRIPT =
  'printf "feat(hooks): add x\\n" | cat - "$1" > "$1.new" && mv "$1.new" "$1"\n';

interface GitRun {
  readonly repository: string;
  readonly args: readonly string[];
  readonly who: NodeJS.ProcessEnv;
}

test('adds both trailers once to an agent commit', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', SUBJECT], who: AGENT,
  });

  assert.deepEqual(
    [commitRun.status, commitRun.stderr, getHeadMessage(repository)],
    [0, '', `${ SUBJECT }\n\n${ TRAILERS }`],
  );
});

test('keeps one copy of each trailer on an agent amend with the same message', (t) => {
  const repository = makeHookedRepo(t);
  const args = ['commit', '--allow-empty', '-m', SUBJECT];

  runRealGit(t, { repository, args, who: AGENT });

  const amendRun = runRealGit(t, { repository, args: [...args, '--amend'], who: AGENT });

  assert.deepEqual(
    [amendRun.status, getHeadMessage(repository)],
    [0, `${ SUBJECT }\n\n${ TRAILERS }`],
  );
});

test('keeps one copy of each trailer on an agent amend that reuses the message', (t) => {
  const repository = makeHookedRepo(t);

  runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', SUBJECT], who: AGENT,
  });

  const amendRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '--amend', '--no-edit'], who: AGENT,
  });

  assert.deepEqual(
    [amendRun.status, getHeadMessage(repository)],
    [0, `${ SUBJECT }\n\n${ TRAILERS }`],
  );
});

test('keeps the trailers at the end of an agent message whose body holds ---', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository,
    args: ['commit', '--allow-empty', '-m', SUBJECT, '-m', 'Above.\n---\nBelow.'],
    who: AGENT,
  });

  assert.deepEqual(
    [commitRun.status, getHeadMessage(repository)],
    [0, `${ SUBJECT }\n\nAbove.\n---\nBelow.\n\n${ TRAILERS }`],
  );
});

test('adds the trailers to an agent commit an editor wrote with git commit -v', (t) => {
  const repository = makeHookedRepo(t);
  const editor = join(makeTempDir(t), 'editor.sh');

  writeFileSync(editor, EDITOR_SCRIPT);

  const commitRun = runRealGit(t, {
    repository,
    args: ['commit', '--allow-empty', '-v'],
    who: { ...AGENT, GIT_EDITOR: `sh ${ editor }` },
  });

  assert.deepEqual(
    [commitRun.status, commitRun.stderr, getHeadMessage(repository)],
    [0, '', `${ SUBJECT }\n\n${ TRAILERS }`],
  );
});

test('adds no trailer to a commit without CLAUDECODE', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', SUBJECT], who: HUMAN,
  });

  assert.deepEqual([commitRun.status, getHeadMessage(repository)], [0, `${ SUBJECT }\n`]);
});

test('adds no trailer to an agent message whose subject is refused', (t) => {
  const repository = makeHookedRepo(t);

  const commitRun = runRealGit(t, {
    repository, args: ['commit', '--allow-empty', '-m', 'fix(hooks): fixed it'], who: AGENT,
  });

  assert.deepEqual(
    [commitRun.status, readFileSync(join(repository, '.git', 'COMMIT_EDITMSG'), 'utf8')],
    [1, 'fix(hooks): fixed it\n'],
  );
});

// A temporary repository whose git runs the hooks of this repository.
function makeHookedRepo(t: TestContext): string {
  const repository = makeTempRepo(t);

  runGit(['config', 'core.hooksPath', HOOKS], repository);

  return repository;
}

function getHeadMessage(repository: string): string {
  return runGit(['log', '-1', '--format=%B'], repository).replace(/\n$/, '');
}

function runRealGit(t: TestContext, { repository, args, who }: GitRun) {
  return spawnSync('git', args, {
    cwd: repository,
    encoding: 'utf8',
    env: { ...getGitEnv(process.env), HOME: makeTempDir(t), TMPDIR: makeTempDir(t), ...who },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
