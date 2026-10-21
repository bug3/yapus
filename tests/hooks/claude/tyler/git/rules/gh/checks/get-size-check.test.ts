import assert from 'node:assert/strict';
import { symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import type {
  Context,
} from '../../../../../../../../hooks/claude/tyler/git/context/make-context.ts';
import type {
  RunOptions,
  RunResult,
} from '../../../../../../../../hooks/claude/tyler/git/context/run.ts';
import { makeTempDir } from '../../../../../../../helpers/make-temp-dir.ts';
import {
  getSizeCheck,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/checks/get-size-check.ts';

const BASE_ID = 'a'.repeat(40);
const HEAD_ID = 'b'.repeat(40);
const MAIN = 'rev-parse --verify --quiet --end-of-options refs/remotes/origin/main^{commit}';
const DEV = 'rev-parse --verify --quiet --end-of-options refs/remotes/origin/dev^{commit}';
const HEAD = 'rev-parse --verify --quiet --end-of-options HEAD^{commit}';
const DIFF = `--attr-source=${ BASE_ID } -c core.attributesFile=/dev/null `
  + '-c core.bigFileThreshold=2147483647 --no-replace-objects '
  + 'diff --numstat -z --no-ext-diff --no-textconv --no-renames --no-relative '
  + `${ BASE_ID }...${ HEAD_ID }`;
const UPSTREAM = 'rev-parse --verify --quiet --end-of-options @{upstream}^{commit}';
const TOP = 'rev-parse --show-toplevel';
const LOCAL_ATTR = 'rev-parse --path-format=absolute --git-path info/attributes';
const ATTR = '--no-replace-objects -c core.attributesFile=/dev/null check-attr '
  + `--source=${ BASE_ID } --stdin -z linguist-generated`;
const CREATE = [
  'pr', 'create', '-d', '-t', 'feat(hooks): add a check', '-F', '/tmp/b.md', '--base', 'main',
];

const NOT_FOUND: RunResult = { status: 1, stdout: '', stderr: '' };

function ok(stdout: string): RunResult {
  return { status: 0, stdout, stderr: '' };
}

// The answers of a repository with origin/main fetched and HEAD pushed to its upstream,
// whose diff changes 10 lines of one file, and whose files carry no attribute.
const REPOSITORY: Record<string, RunResult> = {
  [MAIN]: ok(`${ BASE_ID }\n`),
  [HEAD]: ok(`${ HEAD_ID }\n`),
  [UPSTREAM]: ok(`${ HEAD_ID }\n`),
  [DIFF]: ok('6\t4\tsrc/a.ts\0'),
  [TOP]: ok('/repo\n'),
  [LOCAL_ATTR]: ok('/nonexistent/yapus/info/attributes\n'),
  [ATTR]: ok('/repo/src/a.ts\0linguist-generated\0unspecified\0'),
};

function contextOf(answers: Record<string, RunResult>, cwd = '/repo/sub'): Context {
  return {
    cwd,
    run: (program, args) => answers[args.join(' ')]
      ?? { failure: `no answer for ${ program } ${ args.join(' ') }` },
  };
}

function callOf(texts: readonly string[], assignments: readonly string[] = []): Call {
  return {
    tool: 'gh',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments,
  };
}

function numstat(changes: readonly string[]): RunResult {
  return ok(changes.map((change) => `${ change }\0`).join(''));
}

test('passes a small pull request without a note', () => {
  assert.equal(getSizeCheck(callOf(CREATE), contextOf(REPOSITORY)), undefined);
});

test('ignores other gh actions and git calls', () => {
  const context = contextOf({});

  assert.equal(getSizeCheck(callOf(['pr', 'edit', '3']), context), undefined);
  assert.equal(getSizeCheck({ ...callOf(CREATE), tool: 'git' }, context), undefined);
});

test('reads gh pr new as gh pr create', () => {
  const answers = { ...REPOSITORY, [DIFF]: numstat(['700\t1\tsrc/a.ts']) };

  assert.match(
    JSON.stringify(getSizeCheck(callOf(['pr', 'new', ...CREATE.slice(2)]), contextOf(answers))),
    /changes 701 lines/,
  );
});

test('notes a size above 400 and passes 400', () => {
  const at = { ...REPOSITORY, [DIFF]: numstat(['300\t100\tsrc/a.ts']) };
  const above = { ...REPOSITORY, [DIFF]: numstat(['300\t101\tsrc/a.ts']) };

  assert.equal(getSizeCheck(callOf(CREATE), contextOf(at)), undefined);
  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(above)), {
    note: 'This pull request changes 401 lines, over 400. '
      + 'Reviewers lose track of a change this size; consider splitting it.',
  });
});

test('refuses a size above 1000 and only notes 1000', () => {
  const at = { ...REPOSITORY, [DIFF]: numstat(['900\t100\tsrc/a.ts']) };
  const above = { ...REPOSITORY, [DIFF]: numstat(['900\t101\tsrc/a.ts']) };

  assert.match(JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(at))), /"note"/);
  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(above)), {
    refusal: '`gh pr create` changes 1001 lines, over 1000; split it',
  });
});

test('adds the lines of every file', () => {
  const answers = { ...REPOSITORY, [DIFF]: numstat(['500\t0\ta.ts', '0\t502\tb.ts']) };

  assert.match(JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(answers))), /1002 lines/);
});

test('does not count a lockfile, wherever it lives', () => {
  const answers = {
    ...REPOSITORY,
    [DIFF]: numstat(['5000\t5000\tpackage-lock.json', '5000\t0\tapp/Cargo.lock', '1\t1\ta.ts']),
    [ATTR]: ok('/repo/a.ts\0linguist-generated\0unspecified\0'),
  };

  assert.equal(getSizeCheck(callOf(CREATE), contextOf(answers)), undefined);
});

test('does not count a file whose linguist-generated attribute is set or true', () => {
  const answers = {
    ...REPOSITORY,
    [DIFF]: numstat(['900\t0\tgen/a.ts', '900\t0\tgen/b.ts', '1\t1\tsrc/c.ts']),
    [ATTR]: ok(
      '/repo/gen/a.ts\0linguist-generated\0set\0'
      + '/repo/gen/b.ts\0linguist-generated\0true\0'
      + '/repo/src/c.ts\0linguist-generated\0unspecified\0',
    ),
  };

  assert.equal(getSizeCheck(callOf(CREATE), contextOf(answers)), undefined);
});

test('counts a file whose linguist-generated attribute is false or unset', () => {
  const answers = {
    ...REPOSITORY,
    [DIFF]: numstat(['600\t0\ta.ts', '600\t0\tb.ts']),
    [ATTR]: ok(
      '/repo/a.ts\0linguist-generated\0false\0/repo/b.ts\0linguist-generated\0unset\0',
    ),
  };

  assert.match(JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(answers))), /1200 lines/);
});

test('counts a binary file as 0 lines', () => {
  const answers = { ...REPOSITORY, [DIFF]: numstat(['-\t-\timg.png', '1\t1\ta.ts']) };

  assert.equal(getSizeCheck(callOf(CREATE), contextOf(answers)), undefined);
});

test('refuses a diff it cannot read', () => {
  const answers = { ...REPOSITORY, [DIFF]: ok('nonsense\0') };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (git diff printed a line the gate cannot read); '
      + 'retry it',
  });
});

test('refuses when git diff fails or exits non-zero', () => {
  const failing = { ...REPOSITORY, [DIFF]: { failure: 'git diff: timed out' } };
  const exiting = { ...REPOSITORY, [DIFF]: { status: 128, stdout: '', stderr: 'fatal: bad\n' } };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(failing)), {
    refusal: 'cannot measure the pull request (git diff: timed out); retry it',
  });
  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(exiting)), {
    refusal: 'cannot measure the pull request (exit 128: fatal: bad); retry it',
  });
});

const OLD_GIT_REFUSAL = {
  refusal: 'the size check of `gh pr create` needs git 2.42 or newer; a person upgrades git',
};
const UNKNOWN_OPTION: RunResult = {
  status: 129,
  stdout: '',
  stderr: "error: unknown option `source=aaaa'\nusage: git check-attr\n",
};

test('names the git version when git diff does not know --attr-source', () => {
  const answers = { ...REPOSITORY, [DIFF]: UNKNOWN_OPTION };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), OLD_GIT_REFUSAL);
});

test('names the git version when git check-attr does not know --source', () => {
  const answers = { ...REPOSITORY, [ATTR]: UNKNOWN_OPTION };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), OLD_GIT_REFUSAL);
});

test('keeps the retry reason for exit 129 that is not an unknown option', () => {
  const answers = { ...REPOSITORY, [DIFF]: { status: 129, stdout: '', stderr: 'usage: git\n' } };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (exit 129: usage: git); retry it',
  });
});

test('refuses when the attributes cannot be read', () => {
  const answers = { ...REPOSITORY, [ATTR]: { failure: 'git check-attr: timed out' } };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (git check-attr: timed out); retry it',
  });
});

test('refuses when the tool call names no working directory', () => {
  const context: Context = {
    cwd: undefined,
    run: () => ({ failure: 'git: the tool call names no working directory' }),
  };

  assert.deepEqual(getSizeCheck(callOf(CREATE), context), {
    refusal: 'cannot measure the pull request (git: the tool call names no working '
      + 'directory); retry it',
  });
});

test('refuses a repository, a head and a GH_REPO assignment', () => {
  const context = contextOf(REPOSITORY);
  const reason = (shown: string): string =>
    `the size of \`gh pr create\` is measured in this directory and branch, so ${ shown } `
    + 'is not allowed; remove it';

  assert.deepEqual(getSizeCheck(callOf([...CREATE, '-R', 'o/r']), context), {
    refusal: reason('--repo'),
  });
  assert.deepEqual(getSizeCheck(callOf([...CREATE, '--head', 'o:b']), context), {
    refusal: reason('--head'),
  });
  assert.deepEqual(getSizeCheck(callOf(CREATE, ['GH_REPO']), context), {
    refusal: reason('GH_REPO'),
  });
  assert.deepEqual(getSizeCheck(callOf(CREATE, ['GIT_DIR']), context), {
    refusal: reason('GIT_DIR'),
  });
});

test('measures against the --base branch on origin', () => {
  const answers = { ...REPOSITORY, [DEV]: ok(`${ BASE_ID }\n`) };

  assert.equal(getSizeCheck(callOf([...CREATE, '--base', 'dev']), contextOf(answers)), undefined);
});

test('refuses a --base branch origin does not have', () => {
  const answers = { ...REPOSITORY, [DEV]: NOT_FOUND };

  assert.deepEqual(getSizeCheck(callOf([...CREATE, '-B', 'dev']), contextOf(answers)), {
    refusal: 'cannot find refs/remotes/origin/dev; fetch origin first',
  });
});

test('refuses a --base that is not a plain branch name', () => {
  const context = contextOf(REPOSITORY);

  assert.deepEqual(getSizeCheck(callOf([...CREATE, '--base', '-x']), context), {
    refusal: 'the --base of `gh pr create` is "-x"; write a plain branch name',
  });
});

test('refuses a --base the shell expands', () => {
  const word = { text: '$B', isOpaque: true, canSplit: false };
  const base = { text: '--base', isOpaque: false, canSplit: false };
  const call = callOf(CREATE);

  assert.match(
    JSON.stringify(
      getSizeCheck({ ...call, words: [...call.words, base, word] }, contextOf(REPOSITORY)),
    ),
    /^\{"refusal":"cannot judge `gh pr create`/,
  );
});

test('refuses when origin/main is not fetched', () => {
  const answers = { ...REPOSITORY, [MAIN]: NOT_FOUND };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot find refs/remotes/origin/main; fetch origin first',
  });
});

test('refuses a create without --base, whatever origin holds', () => {
  assert.deepEqual(getSizeCheck(callOf(CREATE.slice(0, -2)), contextOf(REPOSITORY)), {
    refusal: '`gh pr create` needs --base; give --base <branch>',
  });
});

test('refuses when git cannot read the base ref', () => {
  const fatal = { status: 128, stdout: '', stderr: 'fatal: no\n' };
  const answers = { ...REPOSITORY, [MAIN]: fatal };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (exit 128: fatal: no); retry it',
  });
});

test('refuses when HEAD is not a commit', () => {
  const answers = { ...REPOSITORY, [HEAD]: NOT_FOUND };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (HEAD is not a commit); retry it',
  });
});

const UNPUSHED = '`gh pr create` opens the pull request for the branch as pushed, and HEAD is '
  + 'not what its upstream holds (no upstream, a detached HEAD, or a different commit); '
  + 'push the branch first, then open the pull request';

test('refuses a branch with no upstream or a detached HEAD', () => {
  const answers = { ...REPOSITORY, [UPSTREAM]: NOT_FOUND };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), { refusal: UNPUSHED });
});

test('refuses a branch whose upstream holds another commit than HEAD', () => {
  const answers = { ...REPOSITORY, [UPSTREAM]: ok(`${ BASE_ID }\n`) };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), { refusal: UNPUSHED });
});

test('refuses when git cannot read the upstream', () => {
  const answers = { ...REPOSITORY, [UPSTREAM]: { failure: 'git: timed out' } };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (git: timed out); retry it',
  });
});

test('reads the attributes with the paths on stdin and no system attributes file', () => {
  const seen: RunOptions[] = [];
  const context: Context = {
    cwd: '/repo',
    run: (program, args, options) => {
      if (args.includes('check-attr')) {
        seen.push({ input: options?.input, env: options?.env });
      }

      return contextOf(REPOSITORY).run(program, args, options);
    },
  };

  getSizeCheck(callOf(CREATE), context);

  assert.deepEqual(seen, [{ input: '/repo/src/a.ts\0', env: { GIT_ATTR_NOSYSTEM: '1' } }]);
});

const GENERATED_ONLY = {
  [DIFF]: numstat(['900\t0\tgen/a.ts']),
  [ATTR]: ok('/repo/gen/a.ts\0linguist-generated\0set\0'),
};

test('refuses a repository with attributes of its own', (t) => {
  const file = join(makeTempDir(t), 'attributes');

  writeFileSync(file, 'gen/** linguist-generated\n');

  const answers = { ...REPOSITORY, ...GENERATED_ONLY, [LOCAL_ATTR]: ok(`${ file }\n`) };

  assert.match(
    JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(answers))),
    /changes how git counts lines/,
  );
});

function localAttributesAt(path: string): Record<string, RunResult> {
  return { ...REPOSITORY, ...GENERATED_ONLY, [LOCAL_ATTR]: ok(`${ path }\n`) };
}

test('refuses when the info/attributes file is empty', (t) => {
  const file = join(makeTempDir(t), 'attributes');

  writeFileSync(file, '');

  assert.match(
    JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(localAttributesAt(file)))),
    /changes how git counts lines/,
  );
});

test('refuses when info/attributes is a link, even a dangling one', (t) => {
  const link = join(makeTempDir(t), 'attributes');

  symlinkSync('/nonexistent/yapus/target', link);

  assert.match(
    JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(localAttributesAt(link)))),
    /changes how git counts lines/,
  );
});

test('refuses when info/attributes is a directory', (t) => {
  assert.match(
    JSON.stringify(getSizeCheck(callOf(CREATE), contextOf(localAttributesAt(makeTempDir(t))))),
    /changes how git counts lines/,
  );
});

test('refuses when the path cannot be examined', (t) => {
  const file = join(makeTempDir(t), 'plain');

  writeFileSync(file, '');

  assert.match(
    JSON.stringify(getSizeCheck(
      callOf(CREATE),
      contextOf(localAttributesAt(join(file, 'attributes'))),
    )),
    /changes how git counts lines/,
  );
});

test('keeps the exclusion when nothing is at the info/attributes path', () => {
  assert.equal(
    getSizeCheck(callOf(CREATE), contextOf(localAttributesAt('/nonexistent/yapus/attributes'))),
    undefined,
  );
});

test('refuses when git cannot say where info/attributes is', () => {
  const answers = { ...REPOSITORY, [LOCAL_ATTR]: { failure: 'git rev-parse: timed out' } };

  assert.deepEqual(getSizeCheck(callOf(CREATE), contextOf(answers)), {
    refusal: 'cannot measure the pull request (git rev-parse: timed out); retry it',
  });
});
