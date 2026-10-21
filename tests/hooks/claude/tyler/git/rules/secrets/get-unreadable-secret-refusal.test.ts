import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getUnreadableSecretRefusal,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/secrets/get-unreadable-secret-refusal.ts';
import {
  secretFiles,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/secret-files.ts';

test('refuses a line that names .env', () => {
  assert.equal(
    getUnreadableSecretRefusal("cat .env 'unclosed"),
    secretFiles.reasons.unreadable('.env'),
  );
});

test('refuses a line that names a quoted .env', () => {
  assert.equal(
    getUnreadableSecretRefusal('cat ".env" \'unclosed'),
    secretFiles.reasons.unreadable('.env'),
  );
});

test('refuses a name glued to a redirection and a substitution', () => {
  assert.equal(
    getUnreadableSecretRefusal('x=$(cat<.env'),
    secretFiles.reasons.unreadable('.env'),
  );
});

test('refuses a name that is an option value', () => {
  assert.equal(
    getUnreadableSecretRefusal('run --env-file=.env \'oops'),
    secretFiles.reasons.unreadable('.env'),
  );
});

test('passes a line that names no secret file', () => {
  assert.equal(getUnreadableSecretRefusal("cat README.md 'unclosed"), undefined);
});

test('passes a line that names .env.example', () => {
  assert.equal(getUnreadableSecretRefusal("cat .env.example 'unclosed"), undefined);
});
