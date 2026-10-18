import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getMessages } from '../../../hooks/dashes/get-messages.ts';
import { makeTempDir } from '../../helpers/make-temp-dir.ts';

const MARKDOWN_PATH = '/r/a.md';
const EN_DASH = String.fromCodePoint(0x2013);
const EM_DASH = String.fromCodePoint(0x2014);
const LINE_SEPARATOR = String.fromCodePoint(0x2028);

test('names the line of an em dash in a Write of markdown', async () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: MARKDOWN_PATH, content: `a\nb ${ EM_DASH } c\n` },
  });

  assert.deepEqual(await getMessages(stdinText), [
    'yapus dashes: /r/a.md:2: U+2014; use the ASCII hyphen',
  ]);
});

test('names the line of an en dash in a Write of markdown', async () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: MARKDOWN_PATH, content: `5${ EN_DASH }10\n` },
  });

  assert.deepEqual(await getMessages(stdinText), [
    'yapus dashes: /r/a.md:1: U+2013; use the ASCII hyphen',
  ]);
});

test('returns no message for a Write of markdown with only ASCII hyphens', async () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: MARKDOWN_PATH, content: 'a - b\n' },
  });

  assert.deepEqual(await getMessages(stdinText), []);
});

test('returns no message for a Write of a file that is not markdown', async () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: '/r/a.ts', content: EM_DASH },
  });

  assert.deepEqual(await getMessages(stdinText), []);
});

test('names the file line an Edit lands on', async (t) => {
  const filePath = join(makeTempDir(t), 'a.md');

  writeFileSync(filePath, 'a\nb\nc\n');

  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'b', new_string: `x${ EM_DASH }` },
  });

  assert.deepEqual(await getMessages(stdinText), [
    `yapus dashes: ${ filePath }:2: U+2014; use the ASCII hyphen`,
  ]);
});

test('names the new_string line for an Edit of a missing file', async (t) => {
  const filePath = join(makeTempDir(t), 'missing.md');
  const stdinText = JSON.stringify({
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: 'b', new_string: EN_DASH },
  });

  assert.deepEqual(await getMessages(stdinText), [
    `yapus dashes: ${ filePath }: new_string line 1: U+2013; use the ASCII hyphen`,
  ]);
});

test('reports stdin that is not JSON', async () => {
  assert.deepEqual(await getMessages('{'), [
    'yapus dashes: cannot judge: stdin is not JSON; the call is blocked until the payload is valid',
  ]);
});

test('reports a tool other than Write and Edit', async () => {
  const stdinText = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' } });

  assert.deepEqual(await getMessages(stdinText), [
    'yapus dashes: cannot judge: tool_name "Bash" is not one of Write, Edit; the call is blocked until the payload is valid',
  ]);
});

test('reports a tool name that holds a line separator on one line', async () => {
  const stdinText = JSON.stringify({ tool_name: `A${ LINE_SEPARATOR }B`, tool_input: {} });

  assert.deepEqual(await getMessages(stdinText), [
    'yapus dashes: cannot judge: tool_name "A<U+2028>B" is not one of Write, Edit; the call is blocked until the payload is valid',
  ]);
});
