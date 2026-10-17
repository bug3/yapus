import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { getMarkdownDashLocations } from './get-markdown-dash-locations.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('writes only the ASCII hyphen in every markdown file', () => {
  assert.deepEqual(getMarkdownDashLocations(ROOT), []);
});
