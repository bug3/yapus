import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getAgentProblems } from './get-agent-problems.ts';

interface Agent {
  readonly name: string;
  readonly text: string;
}

test('finds nothing in a read-only agent and a writing agent within their tools', (t) => {
  const root = makeAgents(t, [
    { name: 'reader', text: makeHead('reader', 'Read, Grep, Glob') },
    { name: 'builder', text: makeHead('builder', 'Read, Edit, Write, Bash') },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names every missing field of a definition without a head', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: 'body\n' }]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/reader.md: no name',
    'plugins/p/agents/reader.md: no description',
    'plugins/p/agents/reader.md: no tools',
    'plugins/p/agents/reader.md: no model',
  ]);
});

test('names a launching tool anywhere and a changing tool in a read-only agent', (t) => {
  const root = makeAgents(t, [
    { name: 'builder', text: makeHead('builder', 'Read, Agent') },
    { name: 'diff-reviewer', text: makeHead('diff-reviewer', 'Read, Bash') },
  ]);

  assert.deepEqual(getAgentProblems(root).sort(), [
    'plugins/p/agents/builder.md: lists Agent',
    'plugins/p/agents/diff-reviewer.md: lists Bash',
  ]);
});

test('finds nothing in the finisher that lists Agent', (t) => {
  const root = makeAgents(t, [
    { name: 'finisher', text: makeHead('finisher', 'Read, Edit, Bash, Agent') },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names Agent in an agent other than the finisher', (t) => {
  const root = makeAgents(t, [
    { name: 'finisher', text: makeHead('finisher', 'Read, Agent') },
    { name: 'runner', text: makeHead('runner', 'Read, Agent') },
  ]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/runner.md: lists Agent']);
});

test('names a name that is not the file name', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: makeHead('scout', 'Read') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: name is not reader']);
});

test('names an agent with neither tools nor disallowedTools', (t) => {
  const root = makeAgents(t, [{ name: 'builder', text: makeHeadWith('builder', []) }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/builder.md: no tools']);
});

test('names an agent without tools whose disallowedTools lacks Agent', (t) => {
  const root = makeAgents(t, [
    { name: 'builder', text: makeHeadWith('builder', ['disallowedTools: Read, Grep']) },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/builder.md: does not disallow Agent',
  ]);
});

test('names the changing tool a read-only agent without tools does not disallow', (t) => {
  const root = makeAgents(t, [
    {
      name: 'reader',
      text: makeHeadWith('reader', ['disallowedTools: Agent, Bash, Edit, Write']),
    },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/reader.md: does not disallow NotebookEdit',
  ]);
});

test('finds nothing in a read-only agent without tools that disallows all five', (t) => {
  const root = makeAgents(t, [
    {
      name: 'reader',
      text: makeHeadWith('reader', ['disallowedTools: Agent, Bash, Edit, NotebookEdit, Write']),
    },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

function makeHead(name: string, tools: string): string {
  return makeHeadWith(name, [`tools: ${ tools }`]);
}

function makeHeadWith(name: string, toolLines: readonly string[]): string {
  const lines = [`name: ${ name }`, 'description: "d: x"', ...toolLines, 'model: sonnet'];

  return `---\n${ lines.join('\n') }\n---\n\nbody\n`;
}

function makeAgents(t: TestContext, agents: readonly Agent[]): string {
  const root = makeTempRepo(t);
  const dir = join(root, 'plugins', 'p', 'agents');

  mkdirSync(dir, { recursive: true });

  for (const { name, text } of agents) {
    writeFileSync(join(dir, `${ name }.md`), text);
  }

  return root;
}
