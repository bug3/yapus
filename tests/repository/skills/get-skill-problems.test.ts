import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { makeTempFiles } from '../../helpers/make-temp-repo.ts';
import { getSkillProblems } from './get-skill-problems.ts';

const SKILL = 'plugins/p/skills/write-plan/SKILL.md';
const BODY = 'body\n';

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

function makeSkill(t: TestContext, text: string): string {
  return makeTempFiles(t, [{ path: SKILL, text }]);
}

function makeHead(head: string): string {
  return `---\n${ head }\n---\n\n${ BODY }`;
}
