import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSessionPath,
  getSessionsDirectory,
} from '../../../../../hooks/claude/delegator/sessions/get-session-path.ts';

test('names the sessions directory under .yapus in the project root', () => {
  assert.equal(getSessionsDirectory('/work/app'), '/work/app/.yapus/sessions');
});

test('names the session file by the month and the UTC stamp of the time', () => {
  assert.equal(
    getSessionPath('/work/app', 's1', '2026-11-15T10:00:00.000Z'),
    '/work/app/.yapus/sessions/2026-11/15T10-00-00Z_s1.jsonl',
  );
});

test('keeps every part of the time but the milliseconds', () => {
  assert.equal(
    getSessionPath('/work/app', 'a-b', '2027-01-02T03:04:05.678Z'),
    '/work/app/.yapus/sessions/2027-01/02T03-04-05Z_a-b.jsonl',
  );
});
