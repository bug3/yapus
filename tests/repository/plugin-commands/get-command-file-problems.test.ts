import assert from 'node:assert/strict';
import { type TestContext, test } from 'node:test';
import { makeTempFiles } from '../../helpers/make-temp-repo.ts';
import { getCommandFileProblems } from './get-command-file-problems.ts';

test('names a file in the commands folder of a plugin with the skill file to write', (t) => {
  const root = makeFile(t, 'plugins/p/commands/a.md');

  assert.deepEqual(getCommandFileProblems(root), [
    'plugins/p/commands/a.md: a command file; write plugins/p/skills/a/SKILL.md',
  ]);
});

test('names a file of any extension below the commands folder of a plugin', (t) => {
  const root = makeFile(t, 'plugins/p/commands/sub/b.txt');

  assert.deepEqual(getCommandFileProblems(root), [
    'plugins/p/commands/sub/b.txt: a command file; write plugins/p/skills/b/SKILL.md',
  ]);
});

test('finds nothing for a skill file of a plugin', (t) => {
  const root = makeFile(t, 'plugins/p/skills/a/SKILL.md');

  assert.deepEqual(getCommandFileProblems(root), []);
});

test('finds nothing for a commands folder outside plugins', (t) => {
  const root = makeFile(t, 'tools/commands/a.md');

  assert.deepEqual(getCommandFileProblems(root), []);
});

function makeFile(t: TestContext, path: string): string {
  return makeTempFiles(t, [{ path, text: '' }]);
}
