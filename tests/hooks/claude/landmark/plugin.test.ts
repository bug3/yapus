import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PLUGIN = join(ROOT, 'plugins', 'landmark');
const COMMAND = 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/dashes';
const SUBPROCESS_TIMEOUT_MS = 10000;
const EM_DASH = String.fromCodePoint(0x2014);
const EM_DASH_WRITE = JSON.stringify({
  tool_name: 'Write',
  tool_input: { file_path: '/r/a.md', content: `a ${ EM_DASH } b\n` },
});

test('registers the dashes hook', () => {
  const hooks: unknown = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));

  assert.deepEqual(hooks, {
    hooks: {
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
  const tempDir = makeTempDir(t);

  const commandRun = spawnSync('bash', ['-c', getRegisteredCommand()], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN, HOME: tempDir, TMPDIR: tempDir },
    input: EM_DASH_WRITE,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.deepEqual(
    [commandRun.status, commandRun.stderr],
    [2, 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n'],
  );
});

// The command string of the hooks.json entry, as the harness would run it.
function getRegisteredCommand(): string {
  const hooksText = readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8');
  const commandJson = /"command": ("(?:[^"\\]|\\.)*")/.exec(hooksText)?.[1] ?? '""';
  const command: unknown = JSON.parse(commandJson);

  return typeof command === 'string' ? command : '';
}
