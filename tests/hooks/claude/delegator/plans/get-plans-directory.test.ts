import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPlansDirectory,
} from '../../../../../hooks/claude/delegator/plans/get-plans-directory.ts';

test('names the plans directory under .yapus in the project root', () => {
  assert.equal(getPlansDirectory('/work/app'), '/work/app/.yapus/plans');
});
