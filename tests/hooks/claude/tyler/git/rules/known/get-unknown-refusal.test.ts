import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getUnknownRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/known/get-unknown-refusal.ts';

function gitCall(...texts: readonly string[]): Call {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function ghCall(...texts: readonly string[]): Call {
  return { ...gitCall(...texts), tool: 'gh' };
}

test('refuses a git subcommand the gate does not know', () => {
  assert.equal(
    getUnknownRefusal(gitCall('st')),
    '`git st` is not a command the gate knows (an alias or extension); a person runs it',
  );
});

test('refuses a gh command the gate does not know', () => {
  assert.equal(
    getUnknownRefusal(ghCall('nuke')),
    '`gh nuke` is not a command the gate knows (an alias or extension); a person runs it',
  );
});

test('passes known git commands in any case, and the lfs extension', () => {
  assert.equal(getUnknownRefusal(gitCall('status')), undefined);
  assert.equal(getUnknownRefusal(gitCall('update-ref', '-d', 'x')), undefined);
  assert.equal(getUnknownRefusal(gitCall('STATUS')), undefined);
  assert.equal(getUnknownRefusal(gitCall('lfs', 'pull')), undefined);
});

test('passes known gh commands', () => {
  assert.equal(getUnknownRefusal(ghCall('pr', 'view')), undefined);
  assert.equal(getUnknownRefusal(ghCall('api', 'repos/x/y')), undefined);
});

test('passes a git or gh call with no subcommand', () => {
  assert.equal(getUnknownRefusal(gitCall()), undefined);
  assert.equal(getUnknownRefusal(ghCall()), undefined);
});

test('judges only the first word of a git call', () => {
  assert.equal(getUnknownRefusal(gitCall('status', 'whatever')), undefined);
});

test('passes commands found on this git and gh, and refuses history and transport', () => {
  assert.equal(getUnknownRefusal(gitCall('stage', 'a.ts')), undefined);
  assert.equal(getUnknownRefusal(ghCall('discussion', 'list')), undefined);
  assert.notEqual(getUnknownRefusal(gitCall('history', 'reword')), undefined);
  assert.notEqual(getUnknownRefusal(gitCall('send-pack', 'x')), undefined);
});
