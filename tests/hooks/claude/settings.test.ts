import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { TOOLS } from '../../../hooks/claude/dashes/input/parse-payload.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SETTINGS = join(ROOT, '.claude', 'settings.json');

test('registers the dashes hook for exactly the tools it handles, failing closed', () => {
  const settings: unknown = JSON.parse(readFileSync(SETTINGS, 'utf8'));

  assert.deepEqual(settings, {
    hooks: {
      PreToolUse: [
        {
          matcher: TOOLS.join('|'),
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PROJECT_DIR}/hooks/claude/run.sh" dashes',
              timeout: 10,
              onFailure: 'block',
            },
          ],
        },
      ],
    },
  });
});

test('names a bash entry and a hook that exist', () => {
  const paths = [
    join(ROOT, 'hooks', 'claude', 'run.sh'),
    join(ROOT, 'hooks', 'claude', 'dashes', 'main.ts'),
  ];

  assert.deepEqual(paths.map((path) => existsSync(path)), [true, true]);
});
