import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  holdsEvent,
  readGhEvents,
} from '../../../../../../hooks/claude/gates/gh/handover/read-gh-events.ts';

test('reads a gh call as the two words after gh', () => {
  assert.deepEqual(
    readGhEvents('gh pr merge 5 --squash'),
    [{ kind: 'gh', group: 'pr', action: 'merge' }],
  );
});

test('reads every gh call of a command line in order', () => {
  assert.deepEqual(readGhEvents('cd x && gh pr merge 5; ls | gh issue close 3'), [
    { kind: 'gh', group: 'pr', action: 'merge' },
    { kind: 'gh', group: 'issue', action: 'close' },
  ]);
});

test('reads the other spelling of a judged action as its command', () => {
  assert.deepEqual(readGhEvents('gh pr new -t "a b"; gh issue new'), [
    { kind: 'gh', group: 'pr', action: 'create' },
    { kind: 'gh', group: 'issue', action: 'create' },
  ]);
});

test('reads a gh call behind an assignment, a prefix word and a path', () => {
  assert.deepEqual(
    readGhEvents('GH_PAGER= command /opt/bin/gh pr merge 5'),
    [{ kind: 'gh', group: 'pr', action: 'merge' }],
  );
});

test('reads no event from another program or from gh with fewer than two words', () => {
  assert.deepEqual(readGhEvents('echo gh pr merge; ugh pr merge 5; gh --version; gh'), []);
});

test('reads no event from a command that cannot be split', () => {
  assert.deepEqual(readGhEvents('gh pr merge 5 "a'), []);
});

test('holds a rule event that a call of the command line is', () => {
  const ghEvents = readGhEvents('gh pr view 5 && gh pr merge 5');

  assert.equal(holdsEvent(ghEvents, { kind: 'gh', group: 'pr', action: 'merge' }), true);
});

test('holds a rule event written in the other spelling of a judged action', () => {
  const rule = { kind: 'gh', group: 'pr', action: 'new' } as const;

  assert.deepEqual(
    [holdsEvent(readGhEvents('gh pr create'), rule), holdsEvent(readGhEvents('gh pr new'), rule)],
    [true, true],
  );
});

test('holds no rule event of another gh command and no launch event', () => {
  const ghEvents = readGhEvents('gh pr merge 5');

  assert.deepEqual(
    [
      holdsEvent(ghEvents, { kind: 'gh', group: 'pr', action: 'close' }),
      holdsEvent(ghEvents, { kind: 'gh', group: 'issue', action: 'merge' }),
      holdsEvent(ghEvents, { kind: 'launch', agentType: 'pr' }),
    ],
    [false, false, false],
  );
});
