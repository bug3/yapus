import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLanguage } from '../../../../../hooks/landmark/repo/language/get-language.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { writeFiles } from '../plan/commit-files.ts';

test('chooses TypeScript on an install with no request', (t) => {
  assert.deepEqual(getLanguage(makeTempDir(t), undefined), { language: 'typescript' });
});

test('chooses the requested Go on an install when go.mod is at the root', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['go.mod', 'module x'],
  ]);

  assert.deepEqual(getLanguage(root, 'go'), { language: 'go' });
});

test('refuses a Go install when go.mod is not at the root', (t) => {
  assert.deepEqual(getLanguage(makeTempDir(t), 'go'), {
    refusal: 'go.mod is not at the root; run go mod init first',
  });
});

test('chooses TypeScript on an upgrade with no record', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
  ]);

  assert.deepEqual(getLanguage(root, undefined), { language: 'typescript' });
});

test('chooses the recorded Go on an upgrade with no request', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.claude/yapus/landmark/language', 'go\n'],
    ['go.mod', 'module x'],
  ]);

  assert.deepEqual(getLanguage(root, undefined), { language: 'go' });
});

test('refuses an upgrade whose request differs from the record', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.claude/yapus/landmark/language', 'go\n'],
    ['go.mod', 'module x'],
  ]);

  assert.deepEqual(getLanguage(root, 'typescript'), {
    refusal: 'this repository is set up for go; run /ordo:repo go',
  });
});

test('refuses an upgrade with a request but no record when it is not TypeScript', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['go.mod', 'module x'],
  ]);

  assert.deepEqual(getLanguage(root, 'go'), {
    refusal: 'this repository is set up for typescript; run /ordo:repo typescript',
  });
});

test('refuses a recorded Go upgrade when go.mod is not at the root', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.claude/yapus/landmark/language', 'go\n'],
  ]);

  assert.deepEqual(getLanguage(root, undefined), {
    refusal: 'go.mod is not at the root; run go mod init first',
  });
});

test('refuses an upgrade whose record names an unknown language', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.claude/yapus/landmark/language', 'rust\n'],
  ]);

  assert.deepEqual(getLanguage(root, undefined), {
    refusal:
      '.claude/yapus/landmark/language holds "rust", not a language; set it to typescript or go',
  });
});

test('refuses an unknown language record with a line break by escaping it in one line', (t) => {
  const root = makeTempDir(t);

  writeFiles(root, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.claude/yapus/landmark/language', 'rust\nwrote fake\n'],
  ]);

  assert.deepEqual(getLanguage(root, undefined), {
    refusal:
      '.claude/yapus/landmark/language holds "rust\\nwrote fake", not a language; set it to typescript or go',
  });
});
