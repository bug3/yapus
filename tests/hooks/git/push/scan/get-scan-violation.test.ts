import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getScanViolation } from '../../../../../hooks/git/push/scan/get-scan-violation.ts';
import { getGitEnv } from '../../../../helpers/run-git.ts';
import {
  CLEAN_ANSWER,
  type FakeAnswer,
  type FakeScanner,
  makeFakeScanner,
} from '../../../../helpers/scanner/make-fake-scanner.ts';
import { makeToolDir } from '../../../../helpers/scanner/make-tool-dir.ts';
import { withScanner } from '../../../../helpers/scanner/with-scanner.ts';
import { makeRecord, ZEROS } from './make-record.ts';
import { makeTwoCommits } from './make-two-commits.ts';

const ABSENT = '1'.repeat(40);
const REPORT = '[{"RuleID":"aws-access-token","File":"a.env","StartLine":4,"Secret":"REDACTED"}]';

test('scans a new ref and an update together, the update first', async (t) => {
  const { repository, first, second } = makeTwoCommits(t);
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);
  const records = [makeRecord(second, ZEROS, 'refs/heads/new'), makeRecord(second, first)];

  const violation = await getScanViolation(records, makeQuery(repository, scanner));

  assert.equal(violation, undefined);
  assert.match(
    scanner.readCalls().join('\n'),
    new RegExp(`^git --log-opts=\\^${ first } ${ second } ${ second } --not --remotes=origin/\\*`),
  );
});

test('scans a new ref pushed to a URL with no exclusion', async (t) => {
  const { repository, second } = makeTwoCommits(t);
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);
  const query = { ...makeQuery(repository, scanner), remote: 'https://example.invalid/r.git' };

  await getScanViolation([makeRecord(second, ZEROS)], query);

  assert.match(scanner.readCalls().join('\n'), new RegExp(`^git --log-opts=${ second } --report`));
});

test('names the rule, file and line of a finding and not the secret', async (t) => {
  const { repository, second } = makeTwoCommits(t);
  const scanner = makeFakeScanner(t, { exitCode: 3, stdout: REPORT, stderr: '' });

  assert.equal(
    await getScanViolation([makeRecord(second, ZEROS)], makeQuery(repository, scanner)),
    'secret found: rule aws-access-token, a.env line 4; stop and tell the person;'
    + ' if it was pushed, rotate it; do not rewrite history to hide it',
  );
});

test('refuses a push when the scanner fails and says to retry', async (t) => {
  const { repository, second } = makeTwoCommits(t);
  const failure: FakeAnswer = { exitCode: 1, stdout: '', stderr: 'bad flag\n' };
  const scanner = makeFakeScanner(t, failure);

  assert.equal(
    await getScanViolation([makeRecord(second, ZEROS)], makeQuery(repository, scanner)),
    'cannot scan the outgoing change (exit 1: bad flag); retry it',
  );
});

test('warns once and lets the push go on when the scanner is missing', async (t) => {
  const { repository, second } = makeTwoCommits(t);
  const warnings: string[] = [];
  const env = { PATH: makeToolDir(t, ['git']) };
  const place = { cwd: repository, env, deadline: Date.now() + 30000 };

  const violation = await getScanViolation(
    [makeRecord(second, ZEROS)],
    { place, remote: 'origin', warn: (line) => warnings.push(line) },
  );

  assert.deepEqual(
    [violation, warnings],
    [undefined, ['gitleaks is not installed; the outgoing change is not scanned']],
  );
});

test('refuses an update whose remote sha is missing before it scans', async (t) => {
  const { repository, second } = makeTwoCommits(t);
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  const violation = await getScanViolation(
    [makeRecord(second, ABSENT)],
    makeQuery(repository, scanner),
  );

  assert.deepEqual([violation, scanner.readCalls()], [
    'refs/heads/x is at 111111111111, which this repository does not have;'
    + ' fetch first, then push',
    [],
  ]);
});

test('does not call the scanner for a push that only deletes', async (t) => {
  const { repository } = makeTwoCommits(t);
  const scanner = makeFakeScanner(t, CLEAN_ANSWER);

  const violation = await getScanViolation(
    [makeRecord(ZEROS, ABSENT)],
    makeQuery(repository, scanner),
  );

  assert.deepEqual([violation, scanner.readCalls()], [undefined, []]);
});

function makeQuery(repository: string, scanner: FakeScanner) {
  const env = withScanner(getGitEnv(process.env), scanner);

  return {
    place: { cwd: repository, env, deadline: Date.now() + 30000 },
    remote: 'origin',
    warn: () => undefined,
  };
}
