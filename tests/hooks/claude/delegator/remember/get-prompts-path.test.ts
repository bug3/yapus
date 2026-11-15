import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPromptsPath,
} from '../../../../../hooks/claude/delegator/remember/get-prompts-path.ts';

test('names the session file under .yapus/prompts in the project root', () => {
  assert.equal(getPromptsPath('/work/app', 's1'), '/work/app/.yapus/prompts/s1.jsonl');
});
