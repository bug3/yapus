import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getVerdict, type Verdict } from '../../../../../hooks/claude/gates/gh/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { makeCatalogRoot } from './make-catalog-root.ts';

const BODY = '## Summary\na\n\n## Test plan\nb\n\nBuilt with [yapus](https://yapus.dev)\n';
const CREATE = 'gh pr create -t "feat(hooks): add a check" -l "type: feat,scope: hooks" -a @me';
const NO_TITLE = { kind: 'refuse', reason: '`gh pr create` needs --title; write it' };
const OTHER_ROOT = '/nowhere/other';
const UNKNOWN_CWD = {
  kind: 'refuse',
  reason: 'the --body-file "b.md" of `gh pr create` is relative to a directory this check '
    + 'cannot tell; give an absolute --body-file',
};

interface Machine {
  readonly home: string;
  readonly env: NodeJS.ProcessEnv;
}

// A repository root with the catalogs and x/b.md holding a good body.
function makeRoot(t: TestContext): string {
  const root = makeCatalogRoot(t);

  mkdirSync(join(root, 'x'));
  writeFileSync(join(root, 'x', 'b.md'), BODY);

  return root;
}

// The verdict with a home that holds no exclusion list.
async function judge(t: TestContext, command: string, cwd: string): Promise<Verdict> {
  return getVerdict(command, cwd, { home: makeTempDir(t), env: process.env });
}

// A temporary home whose exclusion list holds listText, with this process's
// environment.
function makeMachine(t: TestContext, listText: string): Machine {
  const home = makeTempDir(t);
  const directory = join(home, '.claude', 'yapus', 'ordo');

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'excluded.json'), listText);

  return { home, env: process.env };
}

function makeListingMachine(t: TestContext, root: string): Machine {
  return makeMachine(t, `${ JSON.stringify([realpathSync(root)]) }\n`);
}

test('passes gh pr create with no title, assignee or body in a listed repository', async (t) => {
  const repo = makeTempRepo(t);
  const subdirectory = join(repo, 'sub');

  mkdirSync(subdirectory);

  assert.deepEqual(
    await getVerdict('gh pr create', subdirectory, makeListingMachine(t, repo)),
    { kind: 'pass' },
  );
});

test('passes gh issue create with no title in a listed project', async (t) => {
  const root = makeRoot(t);

  assert.deepEqual(
    await getVerdict('gh issue create', root, makeListingMachine(t, root)),
    { kind: 'pass' },
  );
});

test('passes gh pr create after a cd into a listed project', async (t) => {
  const listed = makeRoot(t);
  const machine = makeListingMachine(t, listed);

  assert.deepEqual(
    await getVerdict(`cd ${ listed } && gh pr create`, makeRoot(t), machine),
    { kind: 'pass' },
  );
});

test('refuses gh pr create after a cd from a listed project to an unlisted one', async (t) => {
  const listed = makeRoot(t);
  const machine = makeListingMachine(t, listed);

  assert.deepEqual(
    await getVerdict(`cd ${ makeRoot(t) } && gh pr create`, listed, machine),
    NO_TITLE,
  );
});

test('refuses gh pr create in an unlisted project when the list holds another', async (t) => {
  const machine = makeListingMachine(t, makeRoot(t));

  assert.deepEqual(await getVerdict('gh pr create', makeRoot(t), machine), NO_TITLE);
});

test('passes a command it cannot split in a listed project', async (t) => {
  const root = makeRoot(t);

  assert.deepEqual(
    await getVerdict('gh pr create --title "a', root, makeListingMachine(t, root)),
    { kind: 'pass' },
  );
});

test('judges gh pr create as without a list when the list is not JSON', async (t) => {
  const machine = makeMachine(t, '[');

  assert.deepEqual(await getVerdict('gh pr create', makeRoot(t), machine), NO_TITLE);
});

test('refuses gh pr create in a missing directory with no list', async (t) => {
  const missing = join(makeTempDir(t), 'missing');

  assert.deepEqual(await judge(t, 'gh pr create', missing), NO_TITLE);
});

test('refuses gh pr create in a missing directory when the list holds another', async (t) => {
  const missing = join(makeTempDir(t), 'missing');
  const machine = makeMachine(t, `${ JSON.stringify([OTHER_ROOT]) }\n`);

  assert.deepEqual(await getVerdict('gh pr create', missing, machine), NO_TITLE);
});

test('judges by the starting directory\'s catalogs after a cd to an expansion', async (t) => {
  const root = makeRoot(t);
  const body = join(root, 'x', 'b.md');
  const verdict = await judge(t, `cd "$D" && gh pr create -t "Add a check" -F ${ body }`, root);

  assert.equal(verdict.kind, 'refuse');
});

test('judges only the body in a repository without catalogs', async (t) => {
  const root = makeTempDir(t);

  writeFileSync(join(root, 'b.md'), BODY);

  assert.deepEqual(
    await judge(t, 'gh pr create -t "Add a check" -l bug -F b.md', root),
    { kind: 'pass' },
  );
});

test('refuses a body without the footer in a repository without catalogs', async (t) => {
  const root = makeTempDir(t);

  writeFileSync(join(root, 'b.md'), '## Summary\na\n\n## Test plan\nb\n');

  assert.deepEqual(
    await judge(t, 'gh pr create -t "Add a check" -l bug -F b.md', root),
    {
      kind: 'refuse',
      reason: 'the body must end with the lines `Built with [yapus](https://yapus.dev)`; add them',
    },
  );
});

test('reads a relative body file in the directory a cd moved to', async (t) => {
  assert.deepEqual(await judge(t, `cd x && ${ CREATE } --body-file b.md`, makeRoot(t)), {
    kind: 'pass',
  });
});

test('reads a relative body file from the payload directory without a cd', async (t) => {
  assert.deepEqual(
    await judge(t, `${ CREATE } --body-file b.md`, join(makeRoot(t), 'x')),
    { kind: 'pass' },
  );
});

test('refuses a relative body file after a cd in parentheses', async (t) => {
  assert.deepEqual(
    await judge(t, `(cd x) && ${ CREATE } --body-file b.md`, makeRoot(t)),
    UNKNOWN_CWD,
  );
});

test('refuses a relative body file after a cd in a pipeline', async (t) => {
  assert.deepEqual(
    await judge(t, `cd x | cat; ${ CREATE } --body-file b.md`, makeRoot(t)),
    UNKNOWN_CWD,
  );
});

test('refuses a relative body file after a cd to an expansion', async (t) => {
  assert.deepEqual(await judge(t, `cd "$D" && ${ CREATE } -F b.md`, makeRoot(t)), UNKNOWN_CWD);
});

test('refuses a relative body file after a pushd', async (t) => {
  assert.deepEqual(await judge(t, `pushd x && ${ CREATE } -F b.md`, makeRoot(t)), UNKNOWN_CWD);
});

test('judges gh pr new as gh pr create', async (t) => {
  assert.deepEqual(await judge(t, 'gh pr new -t "Add a check"', makeRoot(t)), {
    kind: 'refuse',
    reason: 'the title of `gh pr create` breaks the subject rule: "Add a check" is not in the '
      + 'form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject; '
      + 'rewrite it',
  });
});

test('judges a gh call after assignments and by a path', async (t) => {
  const verdict = await judge(t, 'GH_DEBUG=1 /usr/bin/gh issue new -e', makeRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('passes gh pr edit', async (t) => {
  assert.deepEqual(
    await judge(t, 'gh pr edit 1 --title x --body y', makeRoot(t)),
    { kind: 'pass' },
  );
});

test('passes gh issue edit', async (t) => {
  assert.deepEqual(await judge(t, 'gh issue edit 1 --body y', makeRoot(t)), { kind: 'pass' });
});

test('passes other commands', async (t) => {
  assert.deepEqual(await judge(t, 'git status && ls', makeRoot(t)), { kind: 'pass' });
});

test('passes a heredoc that writes a gh call into a file', async (t) => {
  assert.deepEqual(
    await judge(t, 'cat <<\'EOF\' > notes.md\ngh pr create it\'s\nEOF', makeRoot(t)),
    { kind: 'pass' },
  );
});

test('refuses a command it cannot split when it mentions a judged action', async (t) => {
  assert.deepEqual(await judge(t, 'gh issue create --title "a', makeRoot(t)), {
    kind: 'refuse',
    reason: 'cannot read the command (a double quote is not closed); '
      + 'fix the quoting or the heredoc',
  });
});

test('passes a command it cannot split when it mentions no judged action', async (t) => {
  assert.deepEqual(await judge(t, 'echo "a', makeRoot(t)), { kind: 'pass' });
});

test('refuses a command it cannot split when gh and the action have extra spaces', async (t) => {
  assert.equal((await judge(t, 'gh  pr   create --title "a', makeRoot(t))).kind, 'refuse');
});

test('refuses a command it cannot split when a tab separates gh and the action', async (t) => {
  assert.equal((await judge(t, 'gh\tissue\tnew --title "a', makeRoot(t))).kind, 'refuse');
});

test('passes gh pr create --help', async (t) => {
  assert.deepEqual(await judge(t, 'gh pr create --help', makeRoot(t)), { kind: 'pass' });
});

test('passes gh pr create -h', async (t) => {
  assert.deepEqual(await judge(t, 'gh pr create -h', makeRoot(t)), { kind: 'pass' });
});

test('passes gh issue create --help', async (t) => {
  assert.deepEqual(await judge(t, 'gh issue create --help', makeRoot(t)), { kind: 'pass' });
});

test('passes gh issue create -h', async (t) => {
  assert.deepEqual(await judge(t, 'gh issue create -h', makeRoot(t)), { kind: 'pass' });
});
