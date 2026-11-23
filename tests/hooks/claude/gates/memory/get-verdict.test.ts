import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getVerdict, type Input } from '../../../../../hooks/claude/gates/memory/get-verdict.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeAutoMemory } from '../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../helpers/memory/make-memory-project.ts';

const ALLOW = { kind: 'allow' };
const UNDECLARED = '---\nname: x\ndescription: d\nmetadata:\n  type: project\n---\n\ntext\n';

test('denies a new topic file and names the file and the memory directory', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);
  const verdict = getVerdict(input);

  assert.ok(verdict.kind === 'deny');
  assert.match(verdict.reason, /^yapus delegator memory: x\.md is new in auto memory,/u);
  assert.ok(verdict.reason.includes(
    `\n6. Anything else: ${ input.projectRoot ?? '' }/.yapus/memory/reference/<name>.md.\n`,
  ));
});

test('allows a new topic file that says at the top level why every session needs it', (t) => {
  const content = '---\nname: x\nevery-session: "the person asks for it"\n---\n\ntext\n';

  assert.deepEqual(getVerdict(makeNewTopicInput(t, content)), ALLOW);
});

// The form Claude Code stores the line in, which a call does not carry.
test('denies a new topic file whose declaration stands under another key', (t) => {
  const content = '---\nname: x\nmetadata:\n  every-session: "the person asks"\n---\n\ntext\n';

  assert.equal(getVerdict(makeNewTopicInput(t, content)).kind, 'deny');
});

test('denies a new topic file whose declaration has no quotes', (t) => {
  const content = '---\nname: x\nevery-session: the person asks for it\n---\n\ntext\n';

  assert.equal(getVerdict(makeNewTopicInput(t, content)).kind, 'deny');
});

test('denies a new topic file whose declaration stands in its body', (t) => {
  const content = '---\nname: x\n---\n\nevery-session: "the person asks for it"\n';

  assert.equal(getVerdict(makeNewTopicInput(t, content)).kind, 'deny');
});

test('denies an Edit call that names a topic file that is not on disk', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, []);
  const toolInput = { file_path: join(memoryDirectory, 'x.md'), old_string: '', new_string: 'b' };
  const verdict = getVerdict({
    stdinText: makeCall('Edit', toolInput),
    isOff: false,
    projectRoot: makeMemoryProject(t, []),
    configDirectory,
  });

  assert.equal(verdict.kind, 'deny');
});

test('allows a new file a level below the auto memory directory', (t) => {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, []);
  const toolInput = { file_path: join(memoryDirectory, 'notes', 'x.md'), content: UNDECLARED };
  const verdict = getVerdict({
    stdinText: makeCall('Write', toolInput),
    isOff: false,
    projectRoot: makeMemoryProject(t, []),
    configDirectory,
  });

  assert.deepEqual(verdict, ALLOW);
});

test('allows a new topic file when the project root is not set or is empty', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);

  assert.deepEqual(
    [getVerdict({ ...input, projectRoot: undefined }), getVerdict({ ...input, projectRoot: '' })],
    [ALLOW, ALLOW],
  );
});

test('allows a new topic file where a file stands in the place of the memory directory', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);
  const projectRoot = makeMemoryProject(t, []);

  rmSync(join(projectRoot, '.yapus', 'memory'), { recursive: true });
  writeFileSync(join(projectRoot, '.yapus', 'memory'), 'text\n');

  assert.deepEqual(getVerdict({ ...input, projectRoot }), ALLOW);
});

test('allows a new topic file where a file stands in the place of .yapus', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);
  const projectRoot = makeTempDir(t);

  writeFileSync(join(projectRoot, '.yapus'), 'text\n');

  assert.deepEqual(getVerdict({ ...input, projectRoot }), ALLOW);
});

test('allows a new topic file when the configuration directory is not known', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);

  assert.deepEqual(getVerdict({ ...input, configDirectory: undefined }), ALLOW);
});

test('fails on a call it cannot read and says the write is not judged', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);

  assert.deepEqual(getVerdict({ ...input, stdinText: '{' }), {
    kind: 'failure',
    detail: 'cannot read the tool call (stdin is not JSON); the write is not judged',
  });
});

test('allows a call it cannot read in a session switched off', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);

  assert.deepEqual(getVerdict({ ...input, stdinText: '{', isOff: true }), ALLOW);
});

test('allows a call it cannot read in a project with no memory directory', (t) => {
  const input = makeNewTopicInput(t, UNDECLARED);

  assert.deepEqual(getVerdict({ ...input, stdinText: '{', projectRoot: makeTempDir(t) }), ALLOW);
});

// A Write call of the topic file x.md, which is not on disk, in a session
// that is on and a project that holds a memory directory.
function makeNewTopicInput(t: TestContext, content: string): Input {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, []);

  return {
    stdinText: makeCall('Write', { file_path: join(memoryDirectory, 'x.md'), content }),
    isOff: false,
    projectRoot: makeMemoryProject(t, []),
    configDirectory,
  };
}

function makeCall(toolName: string, toolInput: Readonly<Record<string, string>>): string {
  return JSON.stringify({ session_id: 's1', tool_name: toolName, tool_input: toolInput });
}
