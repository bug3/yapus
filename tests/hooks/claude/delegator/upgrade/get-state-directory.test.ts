import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getStateDirectory,
} from '../../../../../hooks/claude/delegator/upgrade/get-state-directory.ts';

test('names the .yapus directory in the project root', () => {
  assert.equal(getStateDirectory('/work/app'), '/work/app/.yapus');
});
