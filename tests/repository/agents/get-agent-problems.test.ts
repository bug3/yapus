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

test('finds nothing in a read-only and a writing agent definition within their tools', (t) => {
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

test('names any launching tool and a changing tool of a read-only agent definition', (t) => {
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

test('names Agent in an agent definition other than the finisher', (t) => {
  const root = makeAgents(t, [
    { name: 'finisher', text: makeHead('finisher', 'Read, Agent') },
    { name: 'runner', text: makeHead('runner', 'Read, Agent') },
  ]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/runner.md: lists Agent']);
});

test('names Bash in the plan-writer and not in another writing agent definition', (t) => {
  const root = makeAgents(t, [
    { name: 'plan-writer', text: makeHead('plan-writer', 'Read, Write, Bash') },
    { name: 'builder', text: makeHead('builder', 'Read, Write, Bash') },
  ]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/plan-writer.md: lists Bash']);
});

test('finds nothing in the plan-writer within its tools', (t) => {
  const root = makeAgents(t, [
    { name: 'plan-writer', text: makeHead('plan-writer', 'Read, Grep, Glob, Write, Edit') },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names a name that is not the file name', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: makeHead('scout', 'Read') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: name is not reader']);
});

test('names an agent definition with neither tools nor disallowedTools', (t) => {
  const root = makeAgents(t, [{ name: 'builder', text: makeHeadWith('builder', []) }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/builder.md: no tools']);
});

test('names an agent definition without tools whose disallowedTools lacks Agent', (t) => {
  const root = makeAgents(t, [
    { name: 'builder', text: makeHeadWith('builder', ['disallowedTools: Read, Grep']) },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/builder.md: does not disallow Agent',
  ]);
});

test('names changing tools a read-only agent definition without tools does not disallow', (t) => {
  const root = makeAgents(t, [
    {
      name: 'reader',
      text: makeHeadWith('reader', ['disallowedTools: Agent, Bash, Edit, Write']),
    },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/reader.md: does not disallow NotebookEdit',
    'plugins/p/agents/reader.md: does not disallow PowerShell',
  ]);
});

test('finds nothing in a read-only agent definition without tools that disallows all six', (t) => {
  const disallowed = 'Agent, Bash, Edit, NotebookEdit, PowerShell, Write';
  const root = makeAgents(t, [
    { name: 'reader', text: makeHeadWith('reader', [`disallowedTools: ${ disallowed }`]) },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('finds nothing in a read-only agent definition with both lines and no denied tool', (t) => {
  const root = makeAgents(t, [
    {
      name: 'reader',
      text: makeHeadWith('reader', ['tools: Read, Grep', 'disallowedTools: Bash']),
    },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names a changing tool a read-only agent definition both lists and disallows', (t) => {
  const root = makeAgents(t, [
    {
      name: 'reader',
      text: makeHeadWith('reader', ['tools: Read, Bash', 'disallowedTools: Bash']),
    },
  ]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: lists Bash']);
});

test('names a scoped entry of a denied tool as written', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: makeHead('reader', 'Read, Bash(git *)') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: lists Bash(git *)']);
});

test('finds nothing in a writing agent definition that lists a scoped entry', (t) => {
  const root = makeAgents(t, [
    { name: 'builder', text: makeHead('builder', 'Read, Bash(npm test)') },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names the tool a read-only agent definition without tools disallows only scoped', (t) => {
  const disallowed = 'Agent, Bash(git *), Edit, NotebookEdit, PowerShell, Write';
  const root = makeAgents(t, [
    { name: 'reader', text: makeHeadWith('reader', [`disallowedTools: ${ disallowed }`]) },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/reader.md: does not disallow Bash',
  ]);
});

test('names a denied tool in a quoted tools line', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: makeHead('reader', '"Read, Bash"') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: lists Bash']);
});

test('names a denied tool in an inline YAML list of quoted tools', (t) => {
  const root = makeAgents(t, [
    { name: 'reader', text: makeHead('reader', '["Read", "Bash"]') },
  ]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: lists Bash']);
});

test('names an agent definition whose tools line holds no value', (t) => {
  const root = makeAgents(t, [{ name: 'reader', text: makeHead('reader', '') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/reader.md: no tools']);
});

test('finds nothing in a read-only agent definition without tools that quotes all six', (t) => {
  const disallowed = '"Agent, Bash, Edit, NotebookEdit, PowerShell, Write"';
  const root = makeAgents(t, [
    { name: 'reader', text: makeHeadWith('reader', [`disallowedTools: ${ disallowed }`]) },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names PowerShell in a read-only agent definition', (t) => {
  const root = makeAgents(t, [
    { name: 'diff-reviewer', text: makeHead('diff-reviewer', 'Read, PowerShell') },
  ]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/diff-reviewer.md: lists PowerShell',
  ]);
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
