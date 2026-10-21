import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import type {
  Context,
} from '../../../../../../../../hooks/claude/tyler/git/context/make-context.ts';
import type {
  Program,
  RunResult,
} from '../../../../../../../../hooks/claude/tyler/git/context/run.ts';
import {
  getSquashCheck,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/checks/get-squash-check.ts';

interface Ran {
  readonly program: Program;
  readonly args: readonly string[];
}

const SQUASH = ['pr', 'merge', '3', '--squash', '--delete-branch'];
const MERGE = ['pr', 'merge', '3', '--merge', '--delete-branch'];
const OFF = 'squash merges are off here; a person turns them on with yapus.allowSquashMerge';

function contextOf(result: RunResult, ran: Ran[] = []): Context {
  return {
    cwd: '/repo',
    run: (program, args) => {
      ran.push({ program, args });

      return result;
    },
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

test('passes a squash when the setting is true', () => {
  const ran: Ran[] = [];
  const context = contextOf({ status: 0, stdout: 'true\n', stderr: '' }, ran);

  assert.equal(getSquashCheck(callOf(SQUASH), context), undefined);
  assert.deepEqual(ran, [{
    program: 'git',
    args: ['config', '--type=bool', '--get', 'yapus.allowSquashMerge'],
  }]);
});

test('refuses a squash when the setting is false', () => {
  const context = contextOf({ status: 0, stdout: 'false\n', stderr: '' });

  assert.deepEqual(getSquashCheck(callOf(SQUASH), context), { refusal: OFF });
});

test('refuses a squash when the setting is not set', () => {
  const context = contextOf({ status: 1, stdout: '', stderr: '' });

  assert.deepEqual(getSquashCheck(callOf(SQUASH), context), { refusal: OFF });
});

test('refuses a squash when the setting cannot be read', () => {
  const failed = contextOf({ failure: 'git config: timed out' });
  const fatal = contextOf({ status: 128, stdout: '', stderr: 'fatal: not a repository\n' });

  assert.deepEqual(getSquashCheck(callOf(SQUASH), failed), {
    refusal: 'cannot read yapus.allowSquashMerge (git config: timed out); retry it',
  });
  assert.deepEqual(getSquashCheck(callOf(SQUASH), fatal), {
    refusal: 'cannot read yapus.allowSquashMerge (exit 128: fatal: not a repository); retry it',
  });
});

test('reads no setting for a merge commit', () => {
  const ran: Ran[] = [];

  assert.equal(getSquashCheck(callOf(MERGE), contextOf({ failure: 'x' }, ran)), undefined);
  assert.deepEqual(ran, []);
});

test('refuses a repository option and a GH_REPO assignment on any merge', () => {
  const context = contextOf({ status: 0, stdout: 'true\n', stderr: '' });
  const reason = (shown: string): string =>
    '`gh pr merge` is judged against this directory\'s repository, so '
    + `${ shown } is not allowed; remove it`;

  assert.deepEqual(getSquashCheck(callOf([...MERGE, '-R', 'o/r']), context), {
    refusal: reason('--repo'),
  });
  assert.deepEqual(getSquashCheck(callOf(SQUASH, ['GH_REPO']), context), {
    refusal: reason('GH_REPO'),
  });
  assert.deepEqual(getSquashCheck(callOf(SQUASH, ['GIT_DIR']), context), {
    refusal: reason('GIT_DIR'),
  });
  assert.deepEqual(
    getSquashCheck(callOf([...SQUASH, 'https://github.com/o/r/pull/5']), context),
    { refusal: reason('https://github.com/o/r/pull/5') },
  );
});

test('refuses an option the gate does not know', () => {
  const context = contextOf({ status: 0, stdout: 'true\n', stderr: '' });

  assert.deepEqual(getSquashCheck(callOf([...MERGE, '--x']), context), {
    refusal: '`gh pr merge --x` is not an option the gate knows; a person runs it',
  });
});

test('ignores other gh actions and git calls', () => {
  const context = contextOf({ failure: 'x' });

  assert.equal(getSquashCheck(callOf(['pr', 'view']), context), undefined);
  assert.equal(getSquashCheck({ ...callOf(SQUASH), tool: 'git' }, context), undefined);
});
