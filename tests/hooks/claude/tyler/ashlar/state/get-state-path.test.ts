import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStatePath } from '../../../../../../hooks/claude/tyler/ashlar/state/get-state-path.ts';

test('puts a state file under the ashlar folder of the data directory', () => {
  assert.equal(getStatePath('/data', 's1.start'), '/data/ashlar/s1.start');
});
