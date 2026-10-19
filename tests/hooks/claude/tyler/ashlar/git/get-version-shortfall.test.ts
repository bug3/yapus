import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getVersionShortfall,
} from '../../../../../../hooks/claude/tyler/ashlar/git/get-version-shortfall.ts';

test('names a git older than 2.28 and the version to install', () => {
  assert.equal(
    getVersionShortfall('git version 2.27.0\n'),
    'git 2.27.0 found; install git 2.28 or newer',
  );
});

test('accepts git 2.28', () => {
  assert.equal(getVersionShortfall('git version 2.28.0\n'), undefined);
});

test('accepts a vendor git with a suffix', () => {
  assert.equal(getVersionShortfall('git version 2.50.1 (Apple Git-155)\n'), undefined);
});

test('accepts a newer major version', () => {
  assert.equal(getVersionShortfall('git version 3.0.0\n'), undefined);
});
