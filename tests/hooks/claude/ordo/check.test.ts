import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../helpers/make-temp-repo.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'ordo');
const SUBPROCESS_TIMEOUT_MS = 20000;
const PLUGIN_VERSION = getPluginVersion();

interface Arrangement {
  readonly stamp?: string;
  readonly hooksPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly project?: string;
  readonly listText?: string;
}

test('names /ordo:machine when there is no stamp', (t) => {
  const { stdout } = runCheck(t, { hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    'yapus ordo is not installed on this machine; tell the person, and run /ordo:machine when they ask.',
  );
});

test('names /ordo:upgrade when the stamp differs from the plugin version', (t) => {
  const { stdout } = runCheck(t, { stamp: '0.0.1', hooksPath: 'own' });

  assert.equal(
    getContext(stdout),
    `yapus ordo 0.0.1 is installed, the plugin is ${ PLUGIN_VERSION }; tell the person, and run /ordo:upgrade when they ask.`,
  );
});

test('names /ordo:upgrade when the global hooks path is unset', (t) => {
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION });

  assert.equal(
    getContext(stdout),
    'yapus ordo: the global core.hooksPath is unset; tell the person, and run /ordo:upgrade when they ask.',
  );
});

test('names the conflict without a command when the global hooks path is foreign', (t) => {
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: '/elsewhere/hooks' });

  assert.equal(
    getContext(stdout),
    'yapus ordo: the global core.hooksPath is /elsewhere/hooks, not its own; resolve it by hand.',
  );
});

test('names the conflict without a command when the environment injects a hooks path', (t) => {
  const env = {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: '/old',
  };
  const { stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: 'own', env });

  assert.equal(
    getContext(stdout),
    'yapus ordo: GIT_CONFIG_* sets core.hooksPath in this session; retire that injection by hand.',
  );
});

test('stays silent when the stamp matches and the hooks path is its own', (t) => {
  const { status, stdout } = runCheck(t, { stamp: PLUGIN_VERSION, hooksPath: 'own' });

  assert.deepEqual([status, stdout], [0, '']);
});

test('exits 2 with a one-line error on stderr when the plugin manifest is unreadable', (t) => {
  const { status, stdout, stderr } = runCheck(t, {
    stamp: PLUGIN_VERSION,
    hooksPath: 'own',
    breakManifest: true,
  });

  assert.equal(status, 2);
  assert.equal(stdout, '');
  assert.match(stderr, /^yapus ordo check: crashed: [^\n]*; fix the hook\n$/);
});

test('says ordo is off in a project on the exclusion list', (t) => {
  const project = makeTempRepo(t);
  const listText = JSON.stringify([realpathSync(project)]);
  const { status, stdout } = runCheck(t, {
    stamp: PLUGIN_VERSION,
    hooksPath: 'own',
    project,
    listText,
  });

  assert.equal(status, 0);
  assert.equal(getContext(stdout), getOffLine(realpathSync(project)));
});

test('says ordo is off in a listed project also when there is no stamp', (t) => {
  const project = makeTempRepo(t);
  const listText = JSON.stringify([realpathSync(project)]);
  const { status, stdout } = runCheck(t, { hooksPath: 'own', project, listText });

  assert.equal(status, 0);
  assert.equal(getContext(stdout), getOffLine(realpathSync(project)));
});

test('stays silent in a project off the exclusion list', (t) => {
  const listText = JSON.stringify(['/nowhere/other']);
  const { status, stdout } = runCheck(t, {
    stamp: PLUGIN_VERSION,
    hooksPath: 'own',
    project: makeTempRepo(t),
    listText,
  });

  assert.deepEqual([status, stdout], [0, '']);
});

test('shows the violation of an exclusion list that is not JSON', (t) => {
  const project = makeTempRepo(t);
  const { status, stdout, listPath } = runCheck(t, {
    stamp: PLUGIN_VERSION,
    hooksPath: 'own',
    project,
    listText: '["/a/one",',
  });

  assert.equal(status, 0);
  assert.equal(
    getContext(stdout),
    `yapus ordo: ${ listPath } is not JSON; ordo stays on in every project until the person fixes the file by hand.`,
  );
});

// The line the check shows in a project whose main root is on the list.
function getOffLine(root: string): string {
  const line =
    `yapus ordo is off in this project: ${ root } is in ~/.claude/yapus/ordo/excluded.json, so the ordo standards, the git checks, the dashes check and delegator's gh form checks do not apply here; run /ordo:include when the person asks.`;

  return line;
}

// Runs the registered command as the harness would, with a copy of the plugin
// as its root; hooksPath 'own' is the path an install sets; listText, when
// given, is the exclusion list under the test's home.
function runCheck(
  t: TestContext,
  arrangement: Arrangement & { readonly breakManifest?: boolean },
): { status: number | null; stdout: string; stderr: string; listPath: string } {
  const tempDir = makeTempDir(t);
  const home = join(tempDir, 'home');
  const root = join(tempDir, 'plugin');
  const gitConfig = join(tempDir, 'gitconfig');
  const ownHooksPath = join(home, '.claude', 'yapus', 'ordo', 'hooks', 'git');
  const hooksPath = arrangement.hooksPath === 'own' ? ownHooksPath : arrangement.hooksPath;
  const listPath = join(home, '.claude', 'yapus', 'ordo', 'excluded.json');

  mkdirSync(home);
  copyPlugin(root);
  writeFileSync(
    gitConfig,
    hooksPath === undefined ? '' : `[core]\n\thooksPath = ${ hooksPath }\n`,
  );

  if (arrangement.stamp !== undefined) {
    mkdirSync(join(home, '.claude', 'yapus', 'ordo'), { recursive: true });
    writeFileSync(join(home, '.claude', 'yapus', 'ordo', 'version'), arrangement.stamp);
  }

  if (arrangement.listText !== undefined) {
    mkdirSync(join(home, '.claude', 'yapus', 'ordo'), { recursive: true });
    writeFileSync(listPath, arrangement.listText);
  }

  if (arrangement.breakManifest === true) {
    writeFileSync(join(root, '.claude-plugin', 'plugin.json'), '{');
  }

  const sessionEnv = Object.fromEntries(
    Object.entries(process.env)
      .filter(([name]) => !name.startsWith('GIT_') && name !== 'CLAUDE_PROJECT_DIR'),
  );
  const projectEnv =
    arrangement.project === undefined ? {} : { CLAUDE_PROJECT_DIR: arrangement.project };
  const commandRun = spawnSync('bash', ['-c', getRegisteredCommand()], {
    encoding: 'utf8',
    env: {
      ...sessionEnv,
      ...arrangement.env,
      ...projectEnv,
      CLAUDE_PLUGIN_ROOT: root,
      HOME: home,
      GIT_CONFIG_GLOBAL: gitConfig,
    },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return {
    status: commandRun.status,
    stdout: commandRun.stdout,
    stderr: commandRun.stderr,
    listPath,
  };
}

// cp -RL resolves every link, as the plugin cache does; the copy must hold none.
function copyPlugin(root: string): void {
  const copyRun = spawnSync('cp', ['-RL', PLUGIN, root], { encoding: 'utf8' });

  assert.equal(copyRun.status, 0, copyRun.stderr);
  assert.deepEqual(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => join(entry.parentPath, entry.name)),
    [],
  );
}

// The additionalContext of the SessionStart output, which must be one JSON line.
function getContext(stdout: string): string {
  const output: unknown = JSON.parse(stdout);

  assert.ok(isRecord(output) && isRecord(output.hookSpecificOutput));
  assert.equal(stdout, `${ JSON.stringify(output) }\n`);

  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(typeof context, 'string');

  return String(context);
}

// The command string of the SessionStart entry in hooks.json.
function getRegisteredCommand(): string {
  const hooksText = readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8');
  const checkEntry = /"command": ("(?:[^"\\]|\\.)*ordo\/check(?:[^"\\]|\\.)*")/;
  const commandJson = checkEntry.exec(hooksText)?.[1] ?? '""';
  const command: unknown = JSON.parse(commandJson);

  return typeof command === 'string' ? command : '';
}

// The version in the plugin manifest, which the check compares with the stamp.
function getPluginVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  assert.ok(isRecord(manifest) && typeof manifest.version === 'string');

  return manifest.version;
}
