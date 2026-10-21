import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readBodyFile,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/body/read-body-file.ts';
import type {
  GhArguments,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/read-gh-arguments.ts';
import { makeTempDir } from '../../../../../../../helpers/make-temp-dir.ts';

const COMMAND = 'gh pr comment';

function argsWith(...paths: readonly string[]): GhArguments {
  const words = paths.map((text) => ({ text, isOpaque: false, canSplit: false }));

  return { values: new Map([['body-file', words]]), flags: new Map(), operands: [] };
}

function fileIn(t: TestContext, content: string): string {
  const path = join(makeTempDir(t), 'body.md');

  writeFileSync(path, content);

  return path;
}

test('reads the text of a file at an absolute path', (t) => {
  assert.deepEqual(readBodyFile(argsWith(fileIn(t, 'a\nb\n')), COMMAND), { text: 'a\nb\n' });
});

test('reads the last of several body files', (t) => {
  const first = fileIn(t, 'first');
  const last = fileIn(t, 'last');

  assert.deepEqual(readBodyFile(argsWith(first, last), COMMAND), { text: 'last' });
});

test('refuses a call without a body file', () => {
  const args: GhArguments = { values: new Map(), flags: new Map(), operands: [] };

  assert.deepEqual(readBodyFile(args, COMMAND), {
    refusal: '`gh pr comment` needs --body-file; write it',
  });
});

test('refuses standard input', () => {
  assert.deepEqual(readBodyFile(argsWith('-'), COMMAND), {
    refusal: 'the --body-file of `gh pr comment` is "-"; '
      + 'write an absolute path to a file, not - or a relative path',
  });
});
