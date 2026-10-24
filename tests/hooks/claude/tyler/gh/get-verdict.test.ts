import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getVerdict } from '../../../../../hooks/claude/tyler/gh/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeCatalogRoot } from './make-catalog-root.ts';

const BODY = '## Summary\na\n\n## Test plan\nb\n\nBuilt with yapus\n'
  + 'Co-authored-by: yapus <noreply@yapus.dev>\n';
const CREATE = 'gh pr create -t "feat(hooks): add a check" -l "type: feat,scope: hooks"';
const UNKNOWN_CWD = {
  kind: 'refuse',
  reason: 'the --body-file "b.md" of `gh pr create` is relative to a directory this check '
    + 'cannot tell; give an absolute --body-file',
};

// A repository root with the catalogs and x/b.md holding a good body.
function makeRoot(t: TestContext): string {
  const root = makeCatalogRoot(t);

  mkdirSync(join(root, 'x'));
  writeFileSync(join(root, 'x', 'b.md'), BODY);

  return root;
}

test('judges by the starting directory\'s catalogs after a cd to an expansion', async (t) => {
  const root = makeRoot(t);
  const body = join(root, 'x', 'b.md');
  const verdict = await getVerdict(`cd "$D" && gh pr create -t "Add a check" -F ${ body }`, root);

  assert.equal(verdict.kind, 'refuse');
});

test('judges only the body headings in a repository without catalogs', async (t) => {
  const root = makeTempDir(t);

  writeFileSync(join(root, 'b.md'), '## Summary\na\n\n## Test plan\nb\n');

  assert.deepEqual(
    await getVerdict('gh pr create -t "Add a check" -l bug -F b.md', root),
    { kind: 'pass' },
  );
});

test('reads a relative body file in the directory a cd moved to', async (t) => {
  assert.deepEqual(await getVerdict(`cd x && ${ CREATE } --body-file b.md`, makeRoot(t)), {
    kind: 'pass',
  });
});

test('reads a relative body file from the payload directory without a cd', async (t) => {
  assert.deepEqual(
    await getVerdict(`${ CREATE } --body-file b.md`, join(makeRoot(t), 'x')),
    { kind: 'pass' },
  );
});

test('refuses a relative body file after a cd in parentheses', async (t) => {
  assert.deepEqual(
    await getVerdict(`(cd x) && ${ CREATE } --body-file b.md`, makeRoot(t)),
    UNKNOWN_CWD,
  );
});

test('refuses a relative body file after a cd in a pipeline', async (t) => {
  assert.deepEqual(
    await getVerdict(`cd x | cat; ${ CREATE } --body-file b.md`, makeRoot(t)),
    UNKNOWN_CWD,
  );
});

test('refuses a relative body file after a cd to an expansion', async (t) => {
  assert.deepEqual(await getVerdict(`cd "$D" && ${ CREATE } -F b.md`, makeRoot(t)), UNKNOWN_CWD);
});

test('refuses a relative body file after a pushd', async (t) => {
  assert.deepEqual(await getVerdict(`pushd x && ${ CREATE } -F b.md`, makeRoot(t)), UNKNOWN_CWD);
});

test('judges gh pr new as gh pr create', async (t) => {
  assert.deepEqual(await getVerdict('gh pr new -t "Add a check"', makeRoot(t)), {
    kind: 'refuse',
    reason: 'the title of `gh pr create` breaks the subject rule: "Add a check" is not in the '
      + 'form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject; '
      + 'rewrite it',
  });
});

test('judges a gh call after assignments and by a path', async (t) => {
  const verdict = await getVerdict('GH_DEBUG=1 /usr/bin/gh issue new -e', makeRoot(t));

  assert.equal(verdict.kind, 'refuse');
});

test('passes gh pr edit', async (t) => {
  assert.deepEqual(
    await getVerdict('gh pr edit 1 --title x --body y', makeRoot(t)),
    { kind: 'pass' },
  );
});

test('passes gh issue edit', async (t) => {
  assert.deepEqual(await getVerdict('gh issue edit 1 --body y', makeRoot(t)), { kind: 'pass' });
});

test('passes other commands', async (t) => {
  assert.deepEqual(await getVerdict('git status && ls', makeRoot(t)), { kind: 'pass' });
});

test('passes a heredoc that writes a gh call into a file', async (t) => {
  assert.deepEqual(
    await getVerdict('cat <<\'EOF\' > notes.md\ngh pr create it\'s\nEOF', makeRoot(t)),
    { kind: 'pass' },
  );
});

test('refuses a command it cannot split when it mentions a judged action', async (t) => {
  assert.deepEqual(await getVerdict('gh issue create --title "a', makeRoot(t)), {
    kind: 'refuse',
    reason: 'cannot read the command (a double quote is not closed); '
      + 'fix the quoting or the heredoc',
  });
});

test('passes a command it cannot split when it mentions no judged action', async (t) => {
  assert.deepEqual(await getVerdict('echo "a', makeRoot(t)), { kind: 'pass' });
});

test('refuses a command it cannot split when gh and the action have extra spaces', async (t) => {
  assert.equal((await getVerdict('gh  pr   create --title "a', makeRoot(t))).kind, 'refuse');
});

test('refuses a command it cannot split when a tab separates gh and the action', async (t) => {
  assert.equal((await getVerdict('gh\tissue\tnew --title "a', makeRoot(t))).kind, 'refuse');
});

test('passes gh pr create --help', async (t) => {
  assert.deepEqual(await getVerdict('gh pr create --help', makeRoot(t)), { kind: 'pass' });
});

test('passes gh pr create -h', async (t) => {
  assert.deepEqual(await getVerdict('gh pr create -h', makeRoot(t)), { kind: 'pass' });
});

test('passes gh issue create --help', async (t) => {
  assert.deepEqual(await getVerdict('gh issue create --help', makeRoot(t)), { kind: 'pass' });
});

test('passes gh issue create -h', async (t) => {
  assert.deepEqual(await getVerdict('gh issue create -h', makeRoot(t)), { kind: 'pass' });
});
