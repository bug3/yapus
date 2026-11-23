import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getConfigDirectory,
} from '../../../../../../hooks/claude/delegator/memory/auto/get-config-directory.ts';

test('names CLAUDE_CONFIG_DIR when it is set', () => {
  assert.equal(
    getConfigDirectory({ CLAUDE_CONFIG_DIR: '/config', HOME: '/home/person' }),
    '/config',
  );
});

test('names .claude under HOME when CLAUDE_CONFIG_DIR is not set', () => {
  assert.equal(getConfigDirectory({ HOME: '/home/person' }), '/home/person/.claude');
});

test('gives none when neither variable is set', () => {
  assert.equal(getConfigDirectory({}), undefined);
});

test('reads an empty CLAUDE_CONFIG_DIR as one that is not set', () => {
  assert.equal(
    getConfigDirectory({ CLAUDE_CONFIG_DIR: '', HOME: '/home/person' }),
    '/home/person/.claude',
  );
});

test('reads an empty HOME as one that is not set', () => {
  assert.equal(getConfigDirectory({ HOME: '' }), undefined);
});
