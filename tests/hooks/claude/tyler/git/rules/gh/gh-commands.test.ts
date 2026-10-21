import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ghCommands } from '../../../../../../../hooks/claude/tyler/git/rules/gh/gh-commands.ts';
import {
  ghLabels,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/labels/gh-labels.ts';
import { labelNames } from '../../../../../../../hooks/shared/labels/read-labels.ts';

const { issueKinds, bodies } = ghCommands;

// The types the label catalog names with a `type:` label, sorted.
function catalogTypes(): readonly string[] {
  return 'violation' in ghLabels
    ? [ghLabels.violation]
    : ghLabels
      .filter(({ name }) => name.startsWith(labelNames.typePrefix))
      .map(({ name }) => name.slice(labelNames.typePrefix.length))
      .sort();
}

test('maps every type to a kind that has a body rule, and every body rule is reached', () => {
  const targets = new Set([...issueKinds.byType.values(), issueKinds.fallback]);

  assert.deepEqual([...targets].sort(), [...bodies.issue.keys()].sort());
});

test('names only types of the catalog in the type to kind map', () => {
  assert.deepEqual(
    [...issueKinds.byType.keys()].filter((type) => !catalogTypes().includes(type)),
    [],
  );
});
