import assert from 'node:assert/strict';
import {
  lstatSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { writeFile } from '../../../../hooks/ordo/exclusion/write-file.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

test('replaces a file and leaves no staging file beside it', (t) => {
  const directory = makeTempDir(t);
  const path = join(directory, 'excluded.json');

  writeFileSync(path, '["/a/old"]\n');

  assert.equal(writeFile(path, '["/a/new"]\n'), path);
  assert.equal(readFileSync(path, 'utf8'), '["/a/new"]\n');
  assert.deepEqual(readdirSync(directory), ['excluded.json']);
});

test('creates the directories of a new file', (t) => {
  const path = join(makeTempDir(t), '.claude', 'settings.local.json');

  writeFile(path, '{}\n');

  assert.equal(readFileSync(path, 'utf8'), '{}\n');
});

test('keeps the mode of the file it replaces', (t) => {
  const path = join(makeTempDir(t), 'settings.local.json');

  writeFileSync(path, '{}\n', { mode: 0o600 });
  writeFile(path, '{"model": "opus"}\n');

  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test('writes through a link and keeps the link', (t) => {
  const directory = makeTempDir(t);
  const target = join(directory, 'dotfiles-settings.json');
  const link = join(directory, 'settings.local.json');

  writeFileSync(target, '{}\n');
  symlinkSync(target, link);

  assert.equal(writeFile(link, '{"model": "opus"}\n'), link);
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  assert.equal(readFileSync(target, 'utf8'), '{"model": "opus"}\n');
});

test('leaves the staging file of another writer alone', (t) => {
  const directory = makeTempDir(t);
  const path = join(directory, 'excluded.json');
  const otherStaging = `${ path }.new`;

  writeFileSync(otherStaging, '["/a/oth');
  writeFile(path, '["/a/new"]\n');

  assert.equal(readFileSync(otherStaging, 'utf8'), '["/a/oth');
  assert.equal(readFileSync(path, 'utf8'), '["/a/new"]\n');
});
