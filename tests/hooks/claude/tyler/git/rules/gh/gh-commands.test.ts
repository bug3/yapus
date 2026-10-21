import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ghCommands } from '../../../../../../../hooks/claude/tyler/git/rules/gh/gh-commands.ts';
import {
  ghLabels,
} from '../../../../../../../hooks/claude/tyler/git/rules/gh/labels/gh-labels.ts';
import { labelNames } from '../../../../../../../hooks/shared/labels/read-labels.ts';

// The kinds the label catalog names with a `kind:` label, sorted.
function catalogKinds(): readonly string[] {
  return 'violation' in ghLabels
    ? [ghLabels.violation]
    : ghLabels
      .filter(({ name }) => name.startsWith(labelNames.kindPrefix))
      .map(({ name }) => name.slice(labelNames.kindPrefix.length))
      .sort();
}

test('has a body rule for every kind label of the catalog and for no other', () => {
  assert.deepEqual([...ghCommands.bodies.issue.keys()].sort(), catalogKinds());
});
