import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFindings } from '../../../../../hooks/claude/dashes/findings/get-findings.ts';
import type { ToolCall } from '../../../../../hooks/claude/dashes/input/parse-payload.ts';

const MARKDOWN_PATH = '/r/a.md';
const EN_DASH = String.fromCodePoint(0x2013);
const EM_DASH = String.fromCodePoint(0x2014);

test('reports a Write of markdown holding an em dash at its file line', () => {
  const call: ToolCall = { tool: 'Write', filePath: MARKDOWN_PATH, content: `a\n${ EM_DASH }\n` };

  assert.deepEqual(getFindings(call, undefined), [
    { filePath: MARKDOWN_PATH, place: { kind: 'file', line: 2 }, dashes: [0x2014] },
  ]);
});

test('reports nothing for a Write of markdown with only ASCII hyphens', () => {
  const call: ToolCall = { tool: 'Write', filePath: MARKDOWN_PATH, content: 'a - b\n' };

  assert.deepEqual(getFindings(call, undefined), []);
});

test('reports nothing for a file that is not markdown', () => {
  const call: ToolCall = { tool: 'Write', filePath: '/r/a.ts', content: EM_DASH };

  assert.deepEqual(getFindings(call, undefined), []);
});

test(
  'reports an Edit dash at the line where old_string starts plus its line in new_string',
  () => {
    const call: ToolCall = {
      tool: 'Edit',
      filePath: MARKDOWN_PATH,
      oldString: 'c',
      newString: `x\n${ EM_DASH }`,
    };

    assert.deepEqual(getFindings(call, 'a\nb\nc\n'), [
      { filePath: MARKDOWN_PATH, place: { kind: 'file', line: 4 }, dashes: [0x2014] },
    ]);
  },
);

test('reports an Edit of a repeated old_string at its first occurrence', () => {
  const call: ToolCall = {
    tool: 'Edit',
    filePath: MARKDOWN_PATH,
    oldString: 'x',
    newString: EN_DASH,
  };

  assert.deepEqual(getFindings(call, 'a\nx\nb\nx\n'), [
    { filePath: MARKDOWN_PATH, place: { kind: 'file', line: 2 }, dashes: [0x2013] },
  ]);
});

test('names the new_string line when old_string is not in the file', () => {
  const call: ToolCall = {
    tool: 'Edit',
    filePath: MARKDOWN_PATH,
    oldString: 'z',
    newString: EM_DASH,
  };

  assert.deepEqual(getFindings(call, 'a\n'), [
    { filePath: MARKDOWN_PATH, place: { kind: 'new_string', line: 1 }, dashes: [0x2014] },
  ]);
});

test('names the new_string line when old_string is empty', () => {
  const call: ToolCall = {
    tool: 'Edit',
    filePath: MARKDOWN_PATH,
    oldString: '',
    newString: EM_DASH,
  };

  assert.deepEqual(getFindings(call, 'a\nb\n'), [
    { filePath: MARKDOWN_PATH, place: { kind: 'new_string', line: 1 }, dashes: [0x2014] },
  ]);
});

test('names the new_string line when the file could not be read', () => {
  const call: ToolCall = {
    tool: 'Edit',
    filePath: MARKDOWN_PATH,
    oldString: 'a',
    newString: EM_DASH,
  };

  assert.deepEqual(getFindings(call, undefined), [
    { filePath: MARKDOWN_PATH, place: { kind: 'new_string', line: 1 }, dashes: [0x2014] },
  ]);
});

test('passes an Edit that removes a dash', () => {
  const call: ToolCall = {
    tool: 'Edit',
    filePath: MARKDOWN_PATH,
    oldString: EM_DASH,
    newString: '-',
  };

  assert.deepEqual(getFindings(call, `a ${ EM_DASH } b\n`), []);
});
