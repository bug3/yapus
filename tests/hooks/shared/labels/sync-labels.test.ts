import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const SYNC = join(ROOT, 'hooks', 'shared', 'labels', 'sync-labels.ts');
const SUBPROCESS_TIMEOUT_MS = 30_000;
// Records every argument of a call, each followed by `|`, and fails for the label
// named in FAIL_LABEL.
const FAKE_GH = `#!/bin/bash
printf '%s|' "$@" >> "$RECORD"
echo >> "$RECORD"
if [ "$3" = "$FAIL_LABEL" ]; then
  echo "HTTP 403: first line" >&2
  echo "second line" >&2
  exit 1
fi
`;

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly calls: readonly string[];
}

function runSync(t: TestContext, failLabel = ''): Run {
  const directory = makeTempDir(t);
  const record = join(directory, 'record');

  writeFileSync(record, '');
  writeFileSync(join(directory, 'gh'), FAKE_GH);
  chmodSync(join(directory, 'gh'), 0o755);

  const run = spawnSync(process.execPath, [SYNC], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      PATH: `${ directory }${ delimiter }/usr/bin${ delimiter }/bin`,
      RECORD: record,
      FAIL_LABEL: failLabel,
    },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    calls: readFileSync(record, 'utf8').split('\n').filter((line) => line !== ''),
  };
}

test('creates every catalog label with gh label create --force', (t) => {
  const run = runSync(t);

  assert.equal(run.status, 0);
  assert.equal(run.stderr, '');
  assert.ok(run.calls.includes(
    'label|create|type: feat|--color|0e8a16|--description|Type of change|--force|',
  ));
  assert.ok(run.calls.includes(
    'label|create|scope: hooks|--color|1d76db|--description|Area of the product|--force|',
  ));
  assert.ok(run.calls.includes(
    'label|create|kind: bug|--color|d73a4a|--description|Something does not work|--force|',
  ));
  assert.ok(run.calls.includes(
    'label|create|breaking-change|--color|b60205|--description|Changes what callers rely on'
    + '|--force|',
  ));
});

test('prints one line per label, as many as gh was called', (t) => {
  const run = runSync(t);

  assert.equal(run.stdout.split('\n').filter((line) => line !== '').length, run.calls.length);
  assert.match(run.stdout, /^synced type: chore\n/u);
});

test('stops at the first failure and names the label and gh first line', (t) => {
  const run = runSync(t, 'type: docs');

  assert.equal(run.status, 1);
  assert.equal(run.stderr, 'yapus labels: type: docs: HTTP 403: first line\n');
  assert.equal(run.stdout, 'synced type: chore\n');
  assert.equal(run.calls.length, 2);
});

test('stops when gh is not installed', (t) => {
  const directory = makeTempDir(t);
  const run = spawnSync(process.execPath, [SYNC], {
    cwd: directory,
    encoding: 'utf8',
    env: { PATH: directory },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(run.status, 1);
  assert.equal(run.stderr, 'yapus labels: type: chore: spawnSync gh ENOENT\n');
});
