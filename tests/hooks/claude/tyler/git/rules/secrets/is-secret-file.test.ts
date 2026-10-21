import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isSecretFile,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/is-secret-file.ts';

test('matches .env by its name', () => {
  assert.equal(isSecretFile('.env'), true);
});

test('matches a dotted .env variant', () => {
  assert.equal(isSecretFile('config/.env.production'), true);
});

test('matches a key file by its extension', () => {
  assert.equal(isSecretFile('server.key'), true);
});

test('matches the private key names', () => {
  assert.equal(isSecretFile('~/.ssh/id_rsa'), true);
});

test('matches a name in capitals', () => {
  assert.equal(isSecretFile('.ENV'), true);
});

test('matches a revision and a path', () => {
  assert.equal(isSecretFile('HEAD~2:app/.env'), true);
});

test('matches an option value', () => {
  assert.equal(isSecretFile('--env-file=.env'), true);
});

test('matches a quoted name', () => {
  assert.equal(isSecretFile('".env'), true);
});

test('lets the exception .env.example through', () => {
  assert.equal(isSecretFile('.env.example'), false);
});

test('does not match a name that only contains the pattern', () => {
  assert.equal(isSecretFile('my.env'), false);
});

test('does not match a plain file', () => {
  assert.equal(isSecretFile('README.md'), false);
});

test('does not match a directory named like a key', () => {
  assert.equal(isSecretFile('keys.d/readme'), false);
});
