import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PLUGIN = join(ROOT, 'plugins', 'providens');
const REMEMBER_COMMAND =
  'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/remember || exit 0';
const SUBPROCESS_TIMEOUT_MS = 10000;

test('registers every providens hook', () => {
  const hooks: unknown = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8'));

  assert.deepEqual(hooks, {
    hooks: {
      SessionStart: [
        {
          matcher: 'startup|resume|clear|compact',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/policy',
              timeout: 10,
            },
          ],
        },
        {
          matcher: 'compact',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/recall',
              timeout: 10,
            },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: 'command',
              command: REMEMBER_COMMAND,
              timeout: 10,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Agent',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/gates/launch',
              timeout: 10,
              onFailure: 'block',
            },
          ],
        },
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              if: 'Bash(gh *)',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/gates/gh',
              timeout: 10,
              onFailure: 'block',
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Agent',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/end',
              timeout: 10,
            },
          ],
        },
        {
          matcher: 'SendMessage',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/resume',
              timeout: 10,
            },
          ],
        },
      ],
      SubagentStart: [
        {
          matcher: '^providens:',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/providens/contract',
              timeout: 10,
            },
          ],
        },
      ],
      SubagentStop: [
        {
          matcher: '^providens:',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/gates/return',
              timeout: 10,
              onFailure: 'block',
            },
          ],
        },
      ],
    },
  });
});

// Exit 2 at UserPromptSubmit blocks the prompt, so the registered command
// (pinned above) lets the prompt through even when run.sh itself fails.
test('exits 0 from the remember command when run.sh exits 2', (t) => {
  const pluginRoot = makeTempDir(t);

  mkdirSync(join(pluginRoot, 'runtime'));
  writeFileSync(join(pluginRoot, 'runtime', 'run.sh'), 'exit 2\n');

  const commandRun = spawnSync('/bin/sh', ['-c', REMEMBER_COMMAND], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
    input: '',
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  assert.equal(commandRun.status, 0);
});

// An install copies only the plugin directory and copies a link to elsewhere
// in the repository as content, so the hooks reach the plugin through this.
test('links the plugin runtime to the repository hooks', () => {
  assert.equal(realpathSync(join(PLUGIN, 'runtime')), realpathSync(join(ROOT, 'hooks')));
});
