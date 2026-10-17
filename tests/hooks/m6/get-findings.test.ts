import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFindings } from '../../../hooks/m6/get-findings.ts';
import type { ToolCall } from '../../../hooks/m6/parse-payload.ts';

const MARKDOWN_PATH = '/r/a.md';
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
