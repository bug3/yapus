import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { makeTempFiles } from '../../helpers/make-temp-repo.ts';
import { getSkillProblems } from './get-skill-problems.ts';

const SKILL = 'plugins/p/skills/write-plan/SKILL.md';
const BODY = 'body\n';
const NAMED = 'name: write-plan\ndescription: d';
const SHELL = '!`bash "run.sh" status "$ARGUMENTS"`\n';

test('finds nothing in a skill with its directory name and a description', (t) => {
  const root = makeSkill(t, makeHead('name: write-plan\ndescription: "d: x"'));

  assert.deepEqual(getSkillProblems(root), []);
});

test('names a missing name and description of a skill without a head', (t) => {
  const root = makeSkill(t, BODY);

  assert.deepEqual(getSkillProblems(root), [
    `${ SKILL }: no name`,
    `${ SKILL }: no description`,
  ]);
});

test('names a missing name', (t) => {
  const root = makeSkill(t, makeHead('description: d'));

  assert.deepEqual(getSkillProblems(root), [`${ SKILL }: no name`]);
});

test('names a missing description', (t) => {
  const root = makeSkill(t, makeHead('name: write-plan'));

  assert.deepEqual(getSkillProblems(root), [`${ SKILL }: no description`]);
});

test('names a name that is not the directory name', (t) => {
  const root = makeSkill(t, makeHead('name: scout\ndescription: d'));

  assert.deepEqual(getSkillProblems(root), [`${ SKILL }: name is not write-plan`]);
});

test('ignores a markdown file outside plugins/*/skills/*/SKILL.md', (t) => {
  const root = makeTempFiles(t, [
    { path: 'plugins/p/skills/README.md', text: BODY },
    { path: 'plugins/p/docs/SKILL.md', text: BODY },
  ]);

  assert.deepEqual(getSkillProblems(root), []);
});

test('finds nothing in a shell line that starts with the Bash rule, quotes included', (t) => {
  const root = makeSkill(t, makeShellSkill('allowed-tools: Bash(bash "run.sh" status:*)'));

  assert.deepEqual(getSkillProblems(root), []);
});

test('names the line of a shell line that does not start with the Bash rule', (t) => {
  const root = makeSkill(t, makeShellSkill('allowed-tools: Bash(bash run.sh status:*)'));

  assert.deepEqual(getSkillProblems(root), [
    `${ SKILL }:8: a shell line not allowed by Bash(bash run.sh status:*)`,
  ]);
});

test('names a shell line whose command goes on past the rule within a word', (t) => {
  const root = makeSkill(t, makeShellSkill('allowed-tools: Bash(bash "run.sh" stat:*)'));

  assert.deepEqual(getSkillProblems(root), [
    `${ SKILL }:8: a shell line not allowed by Bash(bash "run.sh" stat:*)`,
  ]);
});

test('names the line of a shell line in a skill with no Bash rule', (t) => {
  const root = makeSkill(t, makeShellSkill('user-invocable: true'));

  assert.deepEqual(getSkillProblems(root), [
    `${ SKILL }:8: a shell line with no allowed-tools Bash rule`,
  ]);
});

test('finds nothing in a skill with a Bash rule and no shell line', (t) => {
  const root = makeSkill(t, makeHead(`${ NAMED }\nallowed-tools: Bash(bash "run.sh" status:*)`));

  assert.deepEqual(getSkillProblems(root), []);
});

function makeSkill(t: TestContext, text: string): string {
  return makeTempFiles(t, [{ path: SKILL, text }]);
}

// A skill with a name and a description, the given head line and a shell line
// on line 8.
function makeShellSkill(line: string): string {
  return `${ makeHead(`${ NAMED }\n${ line }`) }${ SHELL }`;
}

function makeHead(head: string): string {
  return `---\n${ head }\n---\n\n${ BODY }`;
}
