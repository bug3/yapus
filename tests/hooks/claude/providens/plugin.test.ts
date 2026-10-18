import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PLUGIN = join(ROOT, 'plugins', 'providens');

test('registers the policy, the launch gate, the roster contract and the return cap', () => {
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
      ],
      PreToolUse: [
        {
          matcher: 'Agent',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/tyler/launch',
              timeout: 10,
              onFailure: 'block',
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
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/tyler/return',
              timeout: 10,
              onFailure: 'block',
            },
          ],
        },
      ],
    },
  });
});

// An install copies only the plugin directory and copies a link to elsewhere
// in the repository as content, so the hooks reach the plugin through this.
test('links the plugin runtime to the repository hooks', () => {
  assert.equal(realpathSync(join(PLUGIN, 'runtime')), realpathSync(join(ROOT, 'hooks')));
});
