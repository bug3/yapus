import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRefusal } from '../../../../../hooks/claude/tyler/launch/get-refusal.ts';

const LAUNCH = {
  sessionId: 's',
  isNested: false,
  subagentType: 'providens:deacon',
  description: '[standard] Find x',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
};

test('passes a roster launch tagged standard or deep', () => {
  const refusals = [
    getRefusal(LAUNCH),
    getRefusal({ ...LAUNCH, subagentType: 'providens:builder', description: '[deep] Do x' }),
  ];

  assert.deepEqual(refusals, [undefined, undefined]);
});

test('refuses a launch from inside a subagent', () => {
  assert.equal(
    getRefusal({ ...LAUNCH, isNested: true }),
    'a subagent launches no agents; return the work to your caller',
  );
});

test('refuses a built-in agent and names the roster', () => {
  assert.equal(
    getRefusal({ ...LAUNCH, subagentType: 'Explore' }),
    'Explore is not on the roster; launch one of providens:builder, providens:deacon, '
      + 'providens:diff-reviewer, providens:plan-reviewer, providens:proctor, providens:webscribe',
  );
});

test('refuses a description without a depth tag and a quick one', () => {
  const refusals = [
    getRefusal({ ...LAUNCH, description: 'Find x' }),
    getRefusal({ ...LAUNCH, description: '[quick] Find x' }),
  ];

  assert.deepEqual(refusals, [
    'start the description with the depth in brackets: [quick], [standard] or [deep]',
    'a quick task launches no subagent; do it in this session, or raise the depth',
  ]);
});
