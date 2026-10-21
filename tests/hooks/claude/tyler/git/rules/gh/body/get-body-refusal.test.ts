import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  getBodyRefusal,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/body/get-body-refusal.ts';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';
import { makeTempDir } from '../../../../../../../helpers/make-temp-dir.ts';

const RULES = { headings: ['One'], footer: [] };
const COMMAND = 'gh pr create';

function argsWith(path: string | undefined, isOpaque = false): GhArguments {
  const values = path === undefined
    ? new Map()
    : new Map([['body-file', [{ text: path, isOpaque, canSplit: false }]]]);

  return { values, flags: new Map(), operands: [] };
}

function fileIn(t: TestContext, content: string | Buffer): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

test('accepts a body file at an absolute path that follows the rules', (t) => {
  assert.equal(getBodyRefusal(argsWith(fileIn(t, '## One\na\n')), COMMAND, RULES), undefined);
});

test('refuses a call without a body file', () => {
  assert.equal(
    getBodyRefusal(argsWith(undefined), COMMAND, RULES),
    '`gh pr create` needs --body-file; write it',
  );
});

test('refuses a body file path that is not literal', () => {
  assert.equal(
    getBodyRefusal(argsWith('$F', true), COMMAND, RULES),
    'the body file of `gh pr create` is not literal; write the body file literally, the gate reads it',
  );
});

test('refuses standard input and a relative path', () => {
  assert.equal(
    getBodyRefusal(argsWith('-'), COMMAND, RULES),
    'the --body-file of `gh pr create` is "-"; write an absolute path to a file, not - or a relative path',
  );
  assert.equal(
    getBodyRefusal(argsWith('b.md'), COMMAND, RULES),
    'the --body-file of `gh pr create` is "b.md"; write an absolute path to a file, not - or a relative path',
  );
});

test('refuses a file that is missing', (t) => {
  const path = join(makeTempDir(t), 'none.md');

  assert.equal(
    getBodyRefusal(argsWith(path), COMMAND, RULES),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a directory', (t) => {
  const path = join(makeTempDir(t), 'dir');

  mkdirSync(path);

  assert.equal(
    getBodyRefusal(argsWith(path), COMMAND, RULES),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a file over 64 KiB', (t) => {
  const path = fileIn(t, `## One\n${ 'a'.repeat(65_536) }\n`);

  assert.equal(
    getBodyRefusal(argsWith(path), COMMAND, RULES),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a file that is not UTF-8', (t) => {
  const path = fileIn(t, Buffer.from([0xff, 0xfe, 0x23]));

  assert.equal(
    getBodyRefusal(argsWith(path), COMMAND, RULES),
    `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
  );
});

test('refuses a file whose text breaks the rules', (t) => {
  assert.equal(
    getBodyRefusal(argsWith(fileIn(t, 'no heading\n')), COMMAND, RULES),
    'the body must have the `##` headings One in order, each with text under it; fix the file',
  );
});
