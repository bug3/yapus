import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChangedExclusions } from '../../../../hooks/ordo/exclusion/write-exclusions.ts';

test('exclude sorts an upper case root before a lower case one, as the reader checks', () => {
  assert.deepEqual(getChangedExclusions(['/a/b'], '/a/B', 'exclude'), ['/a/B', '/a/b']);
});

test('exclude of a listed root changes nothing', () => {
  assert.equal(getChangedExclusions(['/a/b'], '/a/b', 'exclude'), undefined);
});

test('include takes out only the root', () => {
  assert.deepEqual(getChangedExclusions(['/a/a', '/a/b', '/a/c'], '/a/b', 'include'), [
    '/a/a',
    '/a/c',
  ]);
});

test('include of an unlisted root changes nothing', () => {
  assert.equal(getChangedExclusions(['/a/a'], '/a/b', 'include'), undefined);
});
