import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { appendPlanLine } from '../../../../../hooks/claude/delegator/link/append-plan-line.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const SLICE = { plan: '2026-11/topic', file: 'S1.md' };
const SLICE_LINE = '{"time":"t1","plan":"2026-11/topic","file":"S1.md"}\n';

test('appends the time, the plan and the file as one line, in that order', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');

  writeFileSync(path, '');

  assert.deepEqual(
    [appendPlanLine(path, 't1', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'written' }, SLICE_LINE],
  );
});

test('appends nothing when the last plan line names the same plan and file', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');

  writeFileSync(path, SLICE_LINE);

  assert.deepEqual(
    [appendPlanLine(path, 't3', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'same' }, SLICE_LINE],
  );
});

test('takes a prompt line and a line that is not JSON or not an object for no plan line', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');
  const logged = `${ SLICE_LINE }{"time":"t2","prompt":"go"}\n{\nnull\n`;

  writeFileSync(path, logged);

  assert.deepEqual(
    [appendPlanLine(path, 't3', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'same' }, logged],
  );
});

test('takes a line without both a plan and a file for no plan line', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');
  const planAlone = '{"time":"t2","plan":"2026-11/other"}\n';
  const fileAlone = '{"time":"t2","file":"S2.md"}\n';
  const logged = SLICE_LINE + planAlone + fileAlone;

  writeFileSync(path, logged);

  assert.deepEqual(
    [appendPlanLine(path, 't3', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'same' }, logged],
  );
});

test('appends when an earlier plan line, not the last, names the plan and file', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');
  const planLine = '{"time":"t2","plan":"2026-11/topic","file":"plan.md"}\n';

  writeFileSync(path, SLICE_LINE + planLine);

  assert.deepEqual(
    [appendPlanLine(path, 't1', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'written' }, SLICE_LINE + planLine + SLICE_LINE],
  );
});

test('appends when the last plan line names the file in another plan', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');
  const otherLine = '{"time":"t0","plan":"2026-10/topic","file":"S1.md"}\n';

  writeFileSync(path, otherLine);

  assert.deepEqual(
    [appendPlanLine(path, 't1', SLICE), readFileSync(path, 'utf8')],
    [{ kind: 'written' }, otherLine + SLICE_LINE],
  );
});

test('fails with the path and creates no file when the session file is missing', (t) => {
  const path = join(makeTempDir(t), 's1.jsonl');
  const appended = appendPlanLine(path, 't1', SLICE);

  assert.match(
    JSON.stringify(appended),
    /^\{"kind":"failure","detail":"cannot write .*\/s1\.jsonl: ENOENT.*"\}$/u,
  );
  assert.equal(existsSync(path), false);
});
