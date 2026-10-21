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
  getReadyCheck,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/checks/get-ready-check.ts';

interface Ran {
  readonly program: Program;
  readonly args: readonly string[];
}

const NO_CHECKS_STDERR = "no checks reported on the 'feat/x' branch\n";

function ok(stdout: string): RunResult {
  return { status: 0, stdout, stderr: '' };
}

function checks(...buckets: readonly string[]): string {
  return JSON.stringify(
    buckets.map((bucket, index) => ({ name: `job${ String(index) }`, bucket })),
  );
}

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

const READY = ['pr', 'ready'];

test('passes when every check passed or was skipped', () => {
  const context = contextOf(ok(checks('pass', 'skipping', 'pass')));

  assert.equal(getReadyCheck(callOf(READY), context), undefined);
});

test('asks gh for the name and bucket of the checks of this branch', () => {
  const ran: Ran[] = [];

  getReadyCheck(callOf(READY), contextOf(ok(checks('pass')), ran));

  assert.deepEqual(ran, [{ program: 'gh', args: ['pr', 'checks', '--json', 'name,bucket'] }]);
});

test('passes the pull request argument after --', () => {
  const ran: Ran[] = [];

  getReadyCheck(callOf([...READY, '12']), contextOf(ok(checks('pass')), ran));

  assert.deepEqual(ran, [{
    program: 'gh',
    args: ['pr', 'checks', '--json', 'name,bucket', '--', '12'],
  }]);
});

test('refuses a check that failed, waits or was cancelled, naming each', () => {
  const context = contextOf(ok(checks('pass', 'fail', 'pending', 'cancel')));

  assert.deepEqual(getReadyCheck(callOf(READY), context), {
    refusal: '`gh pr ready` needs every check to pass; these have not: job1 (fail), '
      + 'job2 (pending), job3 (cancel); fix or wait for them, then retry',
  });
});

test('refuses a bucket it does not know', () => {
  const context = contextOf(ok(checks('pass', 'novel')));

  assert.match(
    JSON.stringify(getReadyCheck(callOf(READY), context)),
    /these have not: job1 \(novel\)/,
  );
});

test('reads the list whatever the exit code', () => {
  const failing = contextOf({ status: 1, stdout: checks('fail'), stderr: '' });
  const passing = contextOf({ status: 8, stdout: checks('pass'), stderr: '' });

  assert.match(JSON.stringify(getReadyCheck(callOf(READY), failing)), /job0 \(fail\)/);
  assert.equal(getReadyCheck(callOf(READY), passing), undefined);
});

test('passes a pull request with no checks at all', () => {
  const context = contextOf({ status: 1, stdout: '', stderr: NO_CHECKS_STDERR });

  assert.equal(getReadyCheck(callOf(READY), context), undefined);
});

test('passes an empty check list that exits zero', () => {
  const context = contextOf(ok('[]'));

  assert.equal(getReadyCheck(callOf(READY), context), undefined);
});

test('refuses a stderr that only contains the no-checks message', () => {
  const before = contextOf({ status: 1, stdout: '', stderr: `warning\n${ NO_CHECKS_STDERR }` });
  const after = contextOf({ status: 1, stdout: '', stderr: `${ NO_CHECKS_STDERR }more\n` });
  const quote = "no checks reported on the 'a' b' branch";
  const quoted = contextOf({ status: 1, stdout: '', stderr: quote });

  assert.match(JSON.stringify(getReadyCheck(callOf(READY), before)), /cannot read the checks/);
  assert.match(JSON.stringify(getReadyCheck(callOf(READY), after)), /cannot read the checks/);
  assert.match(JSON.stringify(getReadyCheck(callOf(READY), quoted)), /cannot read the checks/);
});

test('refuses empty output that is not the no-checks error', () => {
  const context = contextOf({ status: 1, stdout: '', stderr: 'HTTP 502: Bad Gateway\n' });

  assert.deepEqual(getReadyCheck(callOf(READY), context), {
    refusal: 'cannot read the checks (exit 1: HTTP 502: Bad Gateway); retry it',
  });
});

test('refuses empty output of a run that exits zero', () => {
  const context = contextOf({ status: 0, stdout: '', stderr: NO_CHECKS_STDERR });

  assert.match(JSON.stringify(getReadyCheck(callOf(READY), context)), /cannot read the checks/);
});

test('refuses when gh cannot run', () => {
  const context = contextOf({ failure: 'gh pr checks: timed out' });

  assert.deepEqual(getReadyCheck(callOf(READY), context), {
    refusal: 'cannot read the checks (gh pr checks: timed out); retry it',
  });
});

const UNREADABLE = {
  refusal: 'cannot read the checks (gh printed checks the gate cannot read); retry it',
};

function readWith(stdout: string): ReturnType<typeof getReadyCheck> {
  return getReadyCheck(callOf(READY), contextOf(ok(stdout)));
}

test('refuses output that is not a list of named checks with a bucket', () => {
  assert.deepEqual(readWith('not json'), UNREADABLE);
  assert.deepEqual(readWith('{"name":"a","bucket":"pass"}'), UNREADABLE);
  assert.deepEqual(readWith('[{"name":"a"}]'), UNREADABLE);
  assert.deepEqual(readWith('[{"bucket":"pass"}]'), UNREADABLE);
  assert.deepEqual(readWith('["pass"]'), UNREADABLE);
});

test('passes --undo without asking gh', () => {
  const ran: Ran[] = [];

  assert.equal(getReadyCheck(callOf([...READY, '--undo']), contextOf(ok('x'), ran)), undefined);
  assert.deepEqual(ran, []);
});

test('asks gh again when --undo is written false', () => {
  const ran: Ran[] = [];

  getReadyCheck(callOf([...READY, '--undo=false']), contextOf(ok(checks('pass')), ran));

  assert.equal(ran.length, 1);
});

test('refuses a repository option and a GH_REPO assignment', () => {
  const context = contextOf(ok(checks('pass')));
  const reason = (shown: string): string =>
    '`gh pr ready` reads the checks of the pull request of this directory\'s branch, so '
    + `${ shown } is not allowed; remove it`;

  assert.deepEqual(getReadyCheck(callOf([...READY, '-R', 'o/r', '3']), context), {
    refusal: reason('--repo'),
  });
  assert.deepEqual(getReadyCheck(callOf(READY, ['GH_REPO']), context), {
    refusal: reason('GH_REPO'),
  });
});

test('refuses an option the gate does not know', () => {
  assert.deepEqual(getReadyCheck(callOf([...READY, '--x']), contextOf(ok(checks('pass')))), {
    refusal: '`gh pr ready --x` is not an option the gate knows; a person runs it',
  });
});

test('ignores other gh actions and git calls', () => {
  const context = contextOf(ok('x'));

  assert.equal(getReadyCheck(callOf(['pr', 'view']), context), undefined);
  assert.equal(getReadyCheck({ ...callOf(READY), tool: 'git' }, context), undefined);
});
