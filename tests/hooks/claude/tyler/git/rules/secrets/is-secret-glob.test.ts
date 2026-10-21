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

test('counts a bracket that never closes as secret', () => {
  assert.equal(isSecretGlob('src/a['), true);
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

test('counts a set with a character class as secret', () => {
  assert.equal(isSecretGlob('src/[[:alpha:]].ts'), true);
});

test('counts a set with a collating symbol as secret', () => {
  assert.equal(isSecretGlob('a[[.-.]]b.ts'), true);
});

test('counts a set with an equivalence class as secret', () => {
  assert.equal(isSecretGlob('a[[=a=]]b.ts'), true);
});

test('counts a command substitution as a star', () => {
  assert.equal(isSecretGlob('$(pwd)/*.pem'), true);
});

test('counts a braced expansion before a star as a star', () => {
  assert.equal(isSecretGlob('${D}*.pem'), true);
});

test('counts a backtick span before a star as a star', () => {
  assert.equal(isSecretGlob('`pwd`*.pem'), true);
});

test('does not match an expansion with no glob character', () => {
  assert.equal(isSecretGlob('$D.pem'), false);
});
