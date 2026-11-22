import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PLUGIN = join(ROOT, 'plugins', 'ordo');
const COMMAND = 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/dashes';
const CHECK_COMMAND =
  'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/ordo/check "${CLAUDE_PLUGIN_ROOT}"';
const SCOPES_COMMAND = 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/ordo/scopes';
const SUBPROCESS_TIMEOUT_MS = 10000;
const OTHER_ROOT = '/nowhere/other';
const DASH_FINDING = 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n';
const EM_DASH = String.fromCodePoint(0x2014);
const EM_DASH_WRITE = JSON.stringify({
  tool_name: 'Write',
  tool_input: { file_path: '/r/a.md', content: `a ${ EM_DASH } b\n` },
});

test('registers the session check, the scope catalog and the dashes hook', () => {
  const hooks: unknown = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));

  assert.deepEqual(hooks, {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|resume|clear|compact',
          hooks: [
            { type: 'command', command: CHECK_COMMAND, timeout: 10 },
            { type: 'command', command: SCOPES_COMMAND, timeout: 10 },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [{ type: 'command', command: COMMAND, timeout: 10, onFailure: 'block' }],
        },
      ],
    },
  });
});

test('links the plugin runtime to the repository hooks', () => {
  assert.equal(realpathSync(join(PLUGIN, 'runtime')), realpathSync(join(ROOT, 'hooks')));
});

test('exits 2 when the registered command runs on a Write that adds a dash', (t) => {
  const commandRun = runRegisteredCommand(t, makeTempDir(t));

  assert.deepEqual([commandRun.status, commandRun.stderr], [2, DASH_FINDING]);
});

test('exits 0 on a Write that adds a dash in a project on the exclusion list', (t) => {
  const project = makeTempRepo(t);
  const home = makeHome(t, [realpathSync(project)]);
  const commandRun = runRegisteredCommand(t, home, { project });

  assert.deepEqual([commandRun.status, commandRun.stderr], [0, '']);
});

test('exits 2 on a Write that adds a dash in a project off the exclusion list', (t) => {
  const home = makeHome(t, [OTHER_ROOT]);
  const commandRun = runRegisteredCommand(t, home, { project: makeTempRepo(t) });

  assert.deepEqual([commandRun.status, commandRun.stderr], [2, DASH_FINDING]);
});

test('exits 2 with the finding when the project directory does not exist', (t) => {
  const home = makeHome(t, [OTHER_ROOT]);
  const commandRun = runRegisteredCommand(t, home, { project: join(makeTempDir(t), 'missing') });

  assert.deepEqual([commandRun.status, commandRun.stderr], [2, DASH_FINDING]);
});

test('exits 2 with the finding in a project when there is no exclusion list', (t) => {
  const commandRun = runRegisteredCommand(t, makeTempDir(t), { project: makeTempRepo(t) });

  assert.deepEqual([commandRun.status, commandRun.stderr], [2, DASH_FINDING]);
});

// Runs the registered command on stdinText, a Write that adds a dash unless
// given, with home as HOME and project, when given, as the session's project
// directory.
function runRegisteredCommand(
  t: TestContext,
  home: string,
  { project, stdinText = EM_DASH_WRITE }: { project?: string; stdinText?: string } = {},
) {
  const tempDir = makeTempDir(t);
  const sessionEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'CLAUDE_PROJECT_DIR'),
  );
  const projectEnv = project === undefined ? {} : { CLAUDE_PROJECT_DIR: project };

  return spawnSync('bash', ['-c', getRegisteredCommand()], {
    encoding: 'utf8',
    env: { ...sessionEnv, ...projectEnv, CLAUDE_PLUGIN_ROOT: PLUGIN, HOME: home, TMPDIR: tempDir },
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// A temporary home whose ordo exclusion list holds roots.
function makeHome(t: TestContext, roots: readonly string[]): string {
  const home = makeTempDir(t);
  const directory = join(home, '.claude', 'yapus', 'ordo');

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'excluded.json'), `${ JSON.stringify(roots) }\n`);

  return home;
}

// The command string of the hooks.json entry, as the harness would run it.
function getRegisteredCommand(): string {
  const hooksText = readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8');
  const commandJson = /"command": ("(?:[^"\\]|\\.)*claude\/dashes")/.exec(hooksText)?.[1] ?? '""';
  const command: unknown = JSON.parse(commandJson);

  return typeof command === 'string' ? command : '';
}
