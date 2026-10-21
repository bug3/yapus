import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSecretGlob,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/is-secret-glob.ts';

test('matches a star after a leading dot', () => {
  assert.equal(isSecretGlob('.e*'), true);
});

test('matches a star by its extension', () => {
  assert.equal(isSecretGlob('*.key'), true);
});

test('matches a question mark', () => {
  assert.equal(isSecretGlob('id_rs?'), true);
});

test('matches a bracket set', () => {
  assert.equal(isSecretGlob('.en[uv]'), true);
});

test('matches a negated bracket set', () => {
  assert.equal(isSecretGlob('x.p1[!3]'), true);
});

test('reads a bracket that never closes as a plain character', () => {
  assert.equal(isSecretGlob('.env['), false);
});

test('does not let a star reach a dotfile', () => {
  assert.equal(isSecretGlob('?env'), false);
});

test('does not match a word with no glob character', () => {
  assert.equal(isSecretGlob('.env'), false);
});

test('does not match a glob for other files', () => {
  assert.equal(isSecretGlob('src/*.ts'), false);
});
