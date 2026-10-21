import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type { Call } from '../../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import type {
  Context,
} from '../../../../../../../../hooks/claude/tyler/git/context/make-context.ts';
import type {
  Program,
  RunOptions,
  RunResult,
} from '../../../../../../../../hooks/claude/tyler/git/context/run.ts';
import type { CheckResult } from '../../../../../../../../hooks/claude/tyler/git/get-verdict.ts';
import {
  getScanCheck,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/scan/get-scan-check.ts';
import { makeTempDir } from '../../../../../../../helpers/make-temp-dir.ts';

interface Ran {
  readonly program: Program;
  readonly args: readonly string[];
  readonly options: RunOptions | undefined;
}

const CLEAN: RunResult = { status: 0, stdout: '[]\n', stderr: '' };
const REPORT = '[{"RuleID":"aws-access-token","File":"","StartLine":2,'
  + '"Match":"AKIAIOSFODNN7EXAMPLE"}]';
const CANNOT = { refusal: 'cannot scan the text; retry it' };

function contextOf(result: RunResult, ran: Ran[] = []): Context {
  return {
    cwd: '/repo',
    run: (program, args, options) => {
      ran.push({ program, args, options });

      return result;
    },
  };
}

function checkOf(result: RunResult): CheckResult {
  return getScanCheck(callOf('pr', 'comment', '13', '-b', 'x'), contextOf(result));
}

function callOf(...texts: readonly string[]): Call {
  return {
    tool: 'gh',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function fileIn(t: TestContext, content: string): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

test('sends the title and the body file of a create through the scanner stdin', (t) => {
  const ran: Ran[] = [];
  const path = fileIn(t, '## Summary\nbody\n');
  const call = callOf('pr', 'create', '--title', 'feat(x): add y', '--body-file', path);

  assert.equal(getScanCheck(call, contextOf(CLEAN, ran)), undefined);
  assert.deepEqual(ran.map(({ program, options }) => ({ program, input: options?.input })), [
    { program: 'scanner', input: 'feat(x): add y\n## Summary\nbody\n' },
  ]);
});

test('calls the scanner with stdin and the arguments of the git hooks', () => {
  const ran: Ran[] = [];

  getScanCheck(callOf('issue', 'comment', '12', '--body', 'Hi'), contextOf(CLEAN, ran));

  assert.match(
    ran[0]?.args.join(' ') ?? '',
    /^stdin --report-format json --report-path - --redact .* --ignore-gitleaks-allow --config \S+ --gitleaks-ignore-path \S+ --exit-code 3 /u,
  );
});

test('sends the title of an edit that has no body file', () => {
  const ran: Ran[] = [];

  getScanCheck(callOf('issue', 'edit', '4', '--title', 'ci: fix a'), contextOf(CLEAN, ran));

  assert.equal(ran[0]?.options?.input, 'ci: fix a');
});

test('sends the body of a comment and of a review', () => {
  const ran: Ran[] = [];

  getScanCheck(callOf('pr', 'comment', '13', '-b', 'Hi there'), contextOf(CLEAN, ran));
  getScanCheck(callOf('pr', 'review', '-r', '--body', 'needs work'), contextOf(CLEAN, ran));

  assert.equal(ran[0]?.options?.input, 'Hi there');
  assert.equal(ran[1]?.options?.input, 'needs work');
});

test('sends the subject, the body and the body file of a merge', (t) => {
  const ran: Ran[] = [];
  const path = fileIn(t, 'from a file\n');
  const call = callOf('pr', 'merge', '3', '-m', '-d', '-t', 'feat: x', '-b', 'text', '-F', path);

  getScanCheck(call, contextOf(CLEAN, ran));

  assert.equal(ran[0]?.options?.input, 'feat: x\ntext\nfrom a file\n');
});

test('refuses a merge whose body holds a secret', () => {
  const call = callOf('pr', 'merge', '3', '-m', '-d', '--body', 'AKIAIOSFODNN7EXAMPLE');

  assert.deepEqual(getScanCheck(call, contextOf({ status: 3, stdout: REPORT, stderr: '' })), {
    refusal: 'the text holds a secret (aws-access-token, line 2); remove it; '
      + 'stop and tell the person',
  });
});

test('refuses a merge subject the shell expands', () => {
  const call: Call = {
    ...callOf('pr', 'merge', '3', '-m', '-d', '--subject', '$S'),
    words: [
      ...['pr', 'merge', '3', '-m', '-d', '--subject'].map((text) => ({
        text,
        isOpaque: false,
        canSplit: false,
      })),
      { text: 'a $S', isOpaque: true, canSplit: false },
    ],
  };

  assert.deepEqual(getScanCheck(call, contextOf(CLEAN)), {
    refusal: 'the subject of `gh pr merge` is not literal; '
      + 'write the subject literally, the gate reads it',
  });
});

test('sends the body file of a comment', (t) => {
  const ran: Ran[] = [];
  const path = fileIn(t, 'from a file\n');

  getScanCheck(callOf('pr', 'comment', '13', '-F', path), contextOf(CLEAN, ran));

  assert.equal(ran[0]?.options?.input, 'from a file\n');
});

test('runs no scan for a call with no text', () => {
  const ran: Ran[] = [];

  const context = contextOf(CLEAN, ran);

  assert.equal(getScanCheck(callOf('pr', 'edit', '4', '--add-label', 'x'), context), undefined);
  assert.equal(getScanCheck(callOf('pr', 'comment', '13', '--delete-last'), context), undefined);
  assert.deepEqual(ran, []);
});

test('scans no other action and no git call', () => {
  const ran: Ran[] = [];
  const gitCall: Call = { ...callOf('pr', 'comment', '-b', 'x'), tool: 'git' };

  assert.equal(getScanCheck(callOf('pr', 'view', '3'), contextOf(CLEAN, ran)), undefined);
  assert.equal(getScanCheck(gitCall, contextOf(CLEAN, ran)), undefined);
  assert.deepEqual(ran, []);
});

test('refuses a finding with its rule and line and never the secret', () => {
  assert.deepEqual(checkOf({ status: 3, stdout: REPORT, stderr: '' }), {
    refusal: 'the text holds a secret (aws-access-token, line 2); remove it; '
      + 'stop and tell the person',
  });
});

test('refuses when the report of a finding cannot be read', () => {
  assert.deepEqual(checkOf({ status: 3, stdout: 'not json', stderr: '' }), CANNOT);
});

test('refuses on any other exit code', () => {
  assert.deepEqual(checkOf({ status: 1, stdout: '', stderr: 'boom\n' }), CANNOT);
});

test('refuses when the scan fails or times out', () => {
  assert.deepEqual(checkOf({ failure: 'scanner stdin: spawnSync gitleaks ETIMEDOUT' }), CANNOT);
});

test('notes a missing scanner and lets the call pass', () => {
  const missing = { failure: 'scanner stdin: spawnSync gitleaks ENOENT', isMissing: true };

  assert.deepEqual(checkOf(missing), {
    note: 'the secret scanner is not installed; the text was not scanned',
  });
});

test('refuses a body file it cannot read', (t) => {
  const path = join(makeTempDir(t), 'none.md');
  const result = getScanCheck(callOf('pr', 'comment', '13', '-F', path), contextOf(CLEAN));

  assert.deepEqual(result, {
    refusal: `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  });
});
