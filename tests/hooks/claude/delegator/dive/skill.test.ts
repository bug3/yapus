import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const SKILL = join(ROOT, 'plugins', 'delegator', 'skills', 'dive-report', 'SKILL.md');

test('holds the dive-report skill that runs the program on its arguments', () => {
  assert.equal(readFileSync(SKILL, 'utf8'), [
    '---',
    'name: dive-report',
    'description: Report the agents, tokens, time, models and tools of one workflow run per stage',
    'argument-hint: <run directory>',
    'allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/dive:*)',
    'disable-model-invocation: true',
    '---',
    '',
    '!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/dive $ARGUMENTS`',
    '',
    'Show the report above to the person as it is; add nothing.',
    '',
  ].join('\n'));
});
