import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getAlwaysLoaded,
  getAlwaysLoadedRules,
  getDuplicateRuleIds,
  getImportedPathsFiles,
} from './get-always-loaded.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

// The ceiling on the rules every session carries (ledger, decision 3 of the
// harness stage): past it, "every rule held" is measured to fall.
const MAX_ALWAYS_LOADED_RULES = 20;

test('loads at most the ceiling of rules in every session', () => {
  assert.deepEqual(getAlwaysLoadedRules(ROOT).slice(MAX_ALWAYS_LOADED_RULES), []);
});

test('imports only files that exist', () => {
  assert.deepEqual(getAlwaysLoaded(ROOT).missing, []);
});

test('loads no path-scoped standard in every session', () => {
  assert.deepEqual(getImportedPathsFiles(ROOT), []);
});

test('gives every rule id one file', () => {
  assert.deepEqual(getDuplicateRuleIds(ROOT), []);
});
