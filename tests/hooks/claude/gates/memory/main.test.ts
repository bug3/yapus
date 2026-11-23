import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readSorting,
} from '../../../../../hooks/claude/delegator/memory/sorting/read-sorting.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../helpers/make-temp-repo.ts';
import { makeAutoMemory } from '../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../helpers/memory/make-memory-project.ts';

const HOOKS = join(import.meta.dirname, '..', '..', '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'claude', 'gates', 'memory', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 10000;
const SILENT_PASS = [0, '', ''];
const DENIAL = /^\{"hookSpecificOutput":\{"hookEventName":"PreToolUse","permissionDecision":"deny",/u;
const UNDECLARED = '---\nname: x\ndescription: d\nmetadata:\n  type: project\n---\n\ntext\n';
const DECLARED = '---\nname: x\nevery-session: "the person asks for it"\n---\n\ntext\n';
const EMPTY_DECLARATION = '---\nname: x\nevery-session: ""\n---\n\ntext\n';
const INDEX = '- [X](x.md): text\n';

test('passes a new topic file in a project with no memory directory and creates none', (t) => {
  const gate = makeGate(t, makeTempDir(t), []);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'x.md'), UNDECLARED));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
  assert.equal(existsSync(join(gate.projectRoot, '.yapus')), false);
});

test('passes a new file outside auto memory', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const gateRun = runGate(gate, makeWrite(join(gate.projectRoot, 'x.md'), UNDECLARED));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('denies a new topic file on stdout at exit 0 with the whole reason', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'x.md'), UNDECLARED));
  const sorting = readSorting(join(gate.projectRoot, '.yapus', 'memory'));

  assert.ok(sorting.kind === 'text');
  assert.deepEqual([gateRun.status, gateRun.stderr], [0, '']);
  assert.deepEqual(JSON.parse(gateRun.stdout), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: [
        'yapus delegator memory: x.md is new in auto memory, which loads in every session; sort the fact first, and write no MEMORY.md line for it unless line 3 fits.',
        sorting.text,
      ].join('\n'),
    },
  });
});

test('passes a new topic file that says why every session needs it', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'x.md'), DECLARED));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('denies a new topic file whose declaration is empty', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'x.md'), EMPTY_DECLARATION));

  assert.deepEqual([gateRun.status, gateRun.stderr], [0, '']);
  assert.match(gateRun.stdout, DENIAL);
});

test('passes a Write of a topic file that is on disk', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), [{ path: 'x.md', text: UNDECLARED }]);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'x.md'), UNDECLARED));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes an Edit of a topic file that is on disk', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), [{ path: 'x.md', text: UNDECLARED }]);
  const gateRun = runGate(gate, makeEdit(join(gate.memoryDirectory, 'x.md')));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes an Edit that creates a topic file and says why every session needs it', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const filePath = join(gate.memoryDirectory, 'x.md');
  const declared = makeCall('Edit', { file_path: filePath, old_string: '', new_string: DECLARED });
  const undeclared = makeCall('Edit', {
    file_path: filePath,
    old_string: '',
    new_string: UNDECLARED,
  });
  const gateRun = runGate(gate, declared);

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
  assert.match(runGate(gate, undeclared).stdout, DENIAL);
});

test('passes a Write of the index', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), [
    { path: 'MEMORY.md', text: INDEX },
    { path: 'x.md', text: UNDECLARED },
  ]);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'MEMORY.md'), INDEX));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes an Edit of the index', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), [
    { path: 'MEMORY.md', text: INDEX },
    { path: 'x.md', text: UNDECLARED },
  ]);
  const gateRun = runGate(gate, makeEdit(join(gate.memoryDirectory, 'MEMORY.md')));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes a Write of a new index that links a file that is not on disk', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const gateRun = runGate(gate, makeWrite(join(gate.memoryDirectory, 'MEMORY.md'), INDEX));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes an Edit of the index that links a file that is not on disk', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), [{ path: 'MEMORY.md', text: INDEX }]);
  const gateRun = runGate(gate, makeEdit(join(gate.memoryDirectory, 'MEMORY.md')));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], SILENT_PASS);
});

test('passes both denied files in a session the mode file switches off', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const topicPath = join(gate.memoryDirectory, 'x.md');

  writeFileSync(join(gate.dataDir, 'mode'), 'off\n');

  const undeclaredRun = runGate(gate, makeWrite(topicPath, UNDECLARED));
  const emptyRun = runGate(gate, makeWrite(topicPath, EMPTY_DECLARATION));

  assert.deepEqual(
    [undeclaredRun.status, undeclaredRun.stdout, undeclaredRun.stderr],
    SILENT_PASS,
  );
  assert.deepEqual([emptyRun.status, emptyRun.stdout, emptyRun.stderr], SILENT_PASS);
});

test('exits 2 with one stderr line and no stdout for stdin that is not JSON', (t) => {
  const gateRun = runGate(makeGate(t, makeMemoryProject(t, []), []), '{');

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], [
    2,
    '',
    'yapus delegator memory: cannot read the tool call (stdin is not JSON); the write is not judged\n',
  ]);
});

test('exits 2 with one stderr line and no stdout for a tool input with no file path', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const call = { session_id: 's1', tool_name: 'Write', tool_input: { content: UNDECLARED } };
  const gateRun = runGate(gate, JSON.stringify(call));

  assert.deepEqual([gateRun.status, gateRun.stdout, gateRun.stderr], [
    2,
    '',
    'yapus delegator memory: cannot read the tool call (tool_input.file_path is not a string); the write is not judged\n',
  ]);
});

test('writes no file when it denies, passes or fails', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const topicPath = join(gate.memoryDirectory, 'x.md');
  const before = listFiles(gate);
  const runs = [
    runGate(gate, makeWrite(topicPath, UNDECLARED)),
    runGate(gate, makeWrite(topicPath, DECLARED)),
    runGate(gate, '{'),
  ];

  assert.deepEqual(runs.map((gateRun) => gateRun.status), [0, 0, 2]);
  assert.deepEqual(listFiles(gate), before);
});

test('denies a new topic file through the bash entry point', (t) => {
  const gate = makeGate(t, makeMemoryProject(t, []), []);
  const entryRun = spawnSync('bash', [RUN_SH, 'claude/gates/memory'], {
    cwd: gate.projectRoot,
    encoding: 'utf8',
    env: gate.env,
    input: makeWrite(join(gate.memoryDirectory, 'x.md'), UNDECLARED),
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual([entryRun.status, entryRun.stderr], [0, '']);
  assert.match(entryRun.stdout, DENIAL);
});

interface Gate {
  // HOME, CLAUDE_CONFIG_DIR, CLAUDE_PLUGIN_DATA and CLAUDE_PROJECT_DIR each
  // in a temporary directory of the test.
  readonly env: NodeJS.ProcessEnv;
  readonly projectRoot: string;
  // The auto memory directory under the configuration directory.
  readonly memoryDirectory: string;
  readonly dataDir: string;
  // Every directory the environment names.
  readonly directories: readonly string[];
}

// The environment of the gate for a session opened in projectRoot, with the
// given files in the auto memory.
function makeGate(t: TestContext, projectRoot: string, files: readonly TempFile[]): Gate {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, files);
  const dataDir = makeTempDir(t);
  const home = makeTempDir(t);

  return {
    env: {
      ...process.env,
      HOME: home,
      CLAUDE_CONFIG_DIR: configDirectory,
      CLAUDE_PLUGIN_DATA: dataDir,
      CLAUDE_PROJECT_DIR: projectRoot,
    },
    projectRoot,
    memoryDirectory,
    dataDir,
    directories: [home, configDirectory, dataDir, projectRoot],
  };
}

function runGate(gate: Gate, stdinText: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd: gate.projectRoot,
    encoding: 'utf8',
    env: gate.env,
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

function makeWrite(filePath: string, content: string): string {
  return makeCall('Write', { file_path: filePath, content });
}

function makeEdit(filePath: string): string {
  return makeCall('Edit', { file_path: filePath, old_string: 'text', new_string: 'other text' });
}

function makeCall(toolName: string, toolInput: Readonly<Record<string, string>>): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  });
}

// Every file and directory below the directories of the gate's environment.
function listFiles(gate: Gate): string[][] {
  return gate.directories.map((directory) => (
    readdirSync(directory, { encoding: 'utf8', recursive: true })
  ));
}
