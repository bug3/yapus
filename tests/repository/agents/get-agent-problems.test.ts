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
    { name: 'deacon', text: makeHead('deacon', 'Read, Grep, Glob') },
    { name: 'builder', text: makeHead('builder', 'Read, Edit, Write, Bash') },
  ]);

  assert.deepEqual(getAgentProblems(root), []);
});

test('names every missing field of a definition without a head', (t) => {
  const root = makeAgents(t, [{ name: 'deacon', text: 'body\n' }]);

  assert.deepEqual(getAgentProblems(root), [
    'plugins/p/agents/deacon.md: no name',
    'plugins/p/agents/deacon.md: no description',
    'plugins/p/agents/deacon.md: no tools',
    'plugins/p/agents/deacon.md: no model',
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

test('names a name that is not the file name', (t) => {
  const root = makeAgents(t, [{ name: 'deacon', text: makeHead('scout', 'Read') }]);

  assert.deepEqual(getAgentProblems(root), ['plugins/p/agents/deacon.md: name is not deacon']);
});

function makeHead(name: string, tools: string): string {
  const head = `name: ${ name }\ndescription: "d: x"\ntools: ${ tools }\nmodel: sonnet`;

  return `---\n${ head }\n---\n\nbody\n`;
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
