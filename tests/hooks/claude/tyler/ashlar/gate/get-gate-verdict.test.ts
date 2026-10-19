import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getGateVerdict,
} from '../../../../../../hooks/claude/tyler/ashlar/gate/get-gate-verdict.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { runGit } from '../../../../../helpers/run-git.ts';
import {
  acceptNow,
  makeContext,
  makeGateFixture,
  makeInput,
  readReasons,
  setThreshold,
  storeBase,
  THREE_LINES,
} from './make-gate-fixture.ts';

test('passes outside a git repository', (t) => {
  const verdict = getGateVerdict(makeInput(makeTempDir(t)), makeContext(makeTempDir(t)));

  assert.deepEqual(verdict, { kind: 'pass' });
});

test('passes a small change with no risk glob and logs nothing', (t) => {
  const fixture = makeGateFixture(t);

  storeBase(fixture);
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.deepEqual(verdict, { kind: 'pass' });
  assert.equal(existsSync(join(fixture.dataDir, 'decisions.jsonl')), false);
});

test('sends back a change over the threshold, writes the diff and logs it', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.equal(verdict.kind, 'review');
  assert.equal(existsSync(join(fixture.repo, '.git', 'ashlar', 's1.diff')), true);
  assert.deepEqual(readReasons(fixture.dataDir), [
    'base fell back to HEAD now',
    'sent back for review',
  ]);
});

test('leaves the tree id unchanged when it writes the diff', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const before = storeBase(fixture);

  getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.deepEqual(storeBase(fixture), before);
});

test('passes the same change on the retry and logs it', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const verdict = getGateVerdict(makeInput(fixture.repo, true), makeContext(fixture.dataDir));

  assert.deepEqual(verdict, { kind: 'pass' });
  assert.deepEqual(readReasons(fixture.dataDir), [
    'base fell back to HEAD now',
    'passed without accepted review',
  ]);
});

test('logs the fall back to HEAD once when the session has no start', (t) => {
  const fixture = makeGateFixture(t);

  getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));
  getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.deepEqual(readReasons(fixture.dataDir), ['base fell back to HEAD now']);
});

test('passes the change a review accepted and logs it', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);
  acceptNow(fixture);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.deepEqual(verdict, { kind: 'pass' });
  assert.deepEqual(readReasons(fixture.dataDir), ['accepted review']);
});

test('sends back again after an edit that follows the acceptance', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);
  acceptNow(fixture);
  writeFileSync(join(fixture.repo, 'b.txt'), `${ THREE_LINES }w\n`);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.equal(verdict.kind, 'review');
});

test('measures a commit made after the session base from that base', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, '1');
  storeBase(fixture);
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);
  runGit(['add', '-A'], fixture.repo);
  runGit(['commit', '--quiet', '-m', 'test(fixture): add file'], fixture.repo);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.equal(verdict.kind, 'review');
});

test('sends back a small change that touches a risk glob', (t) => {
  const fixture = makeGateFixture(t);

  mkdirSync(join(fixture.repo, '.claude'));
  writeFileSync(join(fixture.repo, '.claude', 'ashlar-paths'), 'b.txt\n');
  writeFileSync(join(fixture.repo, 'b.txt'), 'x\n');

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.equal(verdict.kind, 'review');
});

test('logs the fall back to HEAD even when the first stop fails', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, 'many');
  getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.deepEqual(readReasons(fixture.dataDir), ['base fell back to HEAD now']);
});

test('fails when the threshold file holds no number', (t) => {
  const fixture = makeGateFixture(t);

  setThreshold(fixture.dataDir, 'many');
  writeFileSync(join(fixture.repo, 'b.txt'), THREE_LINES);

  const verdict = getGateVerdict(makeInput(fixture.repo), makeContext(fixture.dataDir));

  assert.equal(verdict.kind, 'failure');
});
