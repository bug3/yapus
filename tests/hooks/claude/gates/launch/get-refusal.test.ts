import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRefusal, STAND_INS } from '../../../../../hooks/claude/gates/launch/get-refusal.ts';

const ROSTER_LIST = 'delegator:builder, delegator:diff-reviewer, delegator:finisher, '
  + 'delegator:mcp-operator, delegator:plan-reviewer, delegator:plan-writer, delegator:reader, '
  + 'delegator:runner, delegator:web-researcher';
const OFF_ROSTER = ['claude-code-guide', 'other-plugin:agent', 'db-migrator'];
const LAUNCH = {
  sessionId: 's',
  caller: undefined,
  subagentType: 'delegator:reader',
  description: '[standard] Find x',
  toolUseId: undefined,
  promptId: undefined,
  model: undefined,
  effort: undefined,
};
const NESTED = 'a subagent launches no agents; return the work to your caller';
const REVIEW = {
  ...LAUNCH,
  caller: { agentId: 'a1', agentType: 'delegator:finisher' },
  subagentType: 'delegator:diff-reviewer',
  description: '[deep] s1 Review the diff',
};
const FINISH = {
  ...LAUNCH, subagentType: 'delegator:finisher', description: '[deep] s1 Finish x',
};

test('passes a roster launch tagged standard or deep', () => {
  const refusals = [
    getRefusal(LAUNCH),
    getRefusal({ ...LAUNCH, subagentType: 'delegator:builder', description: '[deep] Do x' }),
  ];

  assert.deepEqual(refusals, [undefined, undefined]);
});

test('passes an off-roster type that stands in for no roster agent', () => {
  const refusals = OFF_ROSTER.flatMap((subagentType) => [
    getRefusal({ ...LAUNCH, subagentType }),
    getRefusal({ ...LAUNCH, subagentType, description: '[deep] Do x' }),
  ]);

  assert.deepEqual(refusals, OFF_ROSTER.flatMap(() => [undefined, undefined]));
});

test('refuses a launch from inside a subagent', () => {
  assert.equal(
    getRefusal({ ...LAUNCH, caller: { agentId: 'a1', agentType: 'delegator:reader' } }),
    'a subagent launches no agents; return the work to your caller',
  );
});

test('refuses a nested launch whose caller type is unknown', () => {
  assert.equal(
    getRefusal({ ...LAUNCH, caller: { agentId: 'a1', agentType: undefined } }),
    'a subagent launches no agents; return the work to your caller',
  );
});

test('passes a finisher launching the diff reviewer', () => {
  assert.equal(getRefusal(REVIEW), undefined);
});

test('refuses a finisher launching a type other than the diff reviewer', () => {
  const refusals = [
    getRefusal({ ...REVIEW, subagentType: 'delegator:finisher' }),
    getRefusal({ ...REVIEW, subagentType: 'delegator:builder' }),
    getRefusal({ ...REVIEW, subagentType: 'general-purpose' }),
  ];

  assert.deepEqual(refusals, [NESTED, NESTED, NESTED]);
});

test('refuses a caller other than the finisher launching the diff reviewer', () => {
  assert.equal(
    getRefusal({ ...REVIEW, caller: { agentId: 'a1', agentType: 'delegator:builder' } }),
    NESTED,
  );
});

test('refuses a caller of unknown type launching the diff reviewer', () => {
  assert.equal(getRefusal({ ...REVIEW, caller: { agentId: 'a1', agentType: undefined } }), NESTED);
});

test('keeps the depth rules for the diff reviewer a finisher launches', () => {
  const refusals = [
    getRefusal({ ...REVIEW, description: 's1 Review the diff' }),
    getRefusal({ ...REVIEW, description: '[quick] s1 Review the diff' }),
  ];

  assert.deepEqual(refusals, [
    'start the description with the depth in brackets: [quick], [standard] or [deep]',
    'a quick task launches no subagent; do it in this session, or raise the depth',
  ]);
});

test('refuses a finisher launched with a depth other than deep', () => {
  const refusals = [
    getRefusal({ ...FINISH, description: '[standard] s1 Finish x' }),
    getRefusal({ ...FINISH, description: '[quick] s1 Finish x' }),
    getRefusal({ ...FINISH, description: 's1 Finish x' }),
  ];

  assert.deepEqual(refusals, [
    'a finisher takes a slice of deep work; start the description with [deep]',
    'a finisher takes a slice of deep work; start the description with [deep]',
    'start the description with the depth in brackets: [quick], [standard] or [deep]',
  ]);
});

test('passes a finisher launched with [deep]', () => {
  assert.equal(getRefusal(FINISH), undefined);
});

test('refuses each stand-in type and names the roster', () => {
  const refusals = STAND_INS.map((subagentType) => getRefusal({ ...LAUNCH, subagentType }));

  assert.deepEqual(refusals, [
    `claude stands in for the roster; launch one of ${ ROSTER_LIST }`,
    `Explore stands in for the roster; launch one of ${ ROSTER_LIST }`,
    `fork stands in for the roster; launch one of ${ ROSTER_LIST }`,
    `general-purpose stands in for the roster; launch one of ${ ROSTER_LIST }`,
    `Plan stands in for the roster; launch one of ${ ROSTER_LIST }`,
  ]);
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

test('keeps the nested and depth rules for an off-roster type', () => {
  const guide = { ...LAUNCH, subagentType: 'claude-code-guide' };
  const refusals = [
    getRefusal({ ...guide, caller: { agentId: 'a1', agentType: 'delegator:reader' } }),
    getRefusal({ ...guide, description: 'Find x' }),
    getRefusal({ ...guide, description: '[quick] Find x' }),
  ];

  assert.deepEqual(refusals, [
    'a subagent launches no agents; return the work to your caller',
    'start the description with the depth in brackets: [quick], [standard] or [deep]',
    'a quick task launches no subagent; do it in this session, or raise the depth',
  ]);
});
