import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMarkdown } from '../../../hooks/m6/is-markdown.ts';

test('treats a .md path as markdown', () => {
  assert.equal(isMarkdown('/r/a.md'), true);
});

test('treats an upper-case .MARKDOWN path as markdown', () => {
  assert.equal(isMarkdown('/r/A.MARKDOWN'), true);
});

test('does not treat a .ts path as markdown', () => {
  assert.equal(isMarkdown('/r/a.ts'), false);
});

test('does not treat a .mdx path as markdown', () => {
  assert.equal(isMarkdown('/r/a.mdx'), false);
});
