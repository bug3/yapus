import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getExclusionPath } from '../../../../hooks/shared/exclusion/get-exclusion-path.ts';

test('places the exclusion list beside the ordo version stamp under home', () => {
  assert.equal(getExclusionPath('/home/person'), '/home/person/.claude/yapus/ordo/excluded.json');
});
