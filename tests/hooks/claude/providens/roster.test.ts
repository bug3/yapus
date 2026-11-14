import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { ROSTER } from '../../../../hooks/claude/gates/launch/get-refusal.ts';

const AGENTS = join(import.meta.dirname, '..', '..', '..', '..', 'plugins', 'providens', 'agents');

test('lets launch exactly the agents the plugin defines', () => {
  const definedAgents = readdirSync(AGENTS).map((file) => basename(file, '.md')).sort();

  assert.deepEqual([...ROSTER], definedAgents);
});
