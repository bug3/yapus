import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getBodyTextRefusal,
} from '../../../../../../../../hooks/claude/tyler/git/rules/gh/body/get-body-text-refusal.ts';

const RULES = { headings: ['One', 'Two'], footer: ['Built', 'By me'] };
const FOOTER_REFUSAL = 'the body must end with the lines `Built` and `By me`; add them';
const HEADINGS_REFUSAL =
  'the body must have the `##` headings One, Two in order, each with text under it; fix the file';

test('accepts a body with the headings in order, text under each, and the footer', () => {
  assert.equal(getBodyTextRefusal('## One\na\n\n## Two\nb\n\nBuilt\nBy me\n', RULES), undefined);
});

test('reads CRLF line ends as LF and ignores blank lines after the footer', () => {
  const body = '## One\r\na\r\n## Two\r\nb\r\nBuilt\r\nBy me\r\n\r\n\r\n';

  assert.equal(getBodyTextRefusal(body, RULES), undefined);
});

test('lets lines come before the first heading', () => {
  assert.equal(getBodyTextRefusal('hello\n## One\na\n## Two\nb\nBuilt\nBy me', RULES), undefined);
});

test('refuses a body without the footer', () => {
  assert.equal(getBodyTextRefusal('## One\na\n## Two\nb\n', RULES), FOOTER_REFUSAL);
});

test('refuses a footer in the wrong order', () => {
  assert.equal(getBodyTextRefusal('## One\na\n## Two\nb\nBy me\nBuilt', RULES), FOOTER_REFUSAL);
});

test('refuses a footer with text after it', () => {
  const body = '## One\na\n## Two\nb\nBuilt\nBy me\nmore';

  assert.equal(getBodyTextRefusal(body, RULES), FOOTER_REFUSAL);
});

test('refuses a missing heading', () => {
  assert.equal(getBodyTextRefusal('## One\na\nBuilt\nBy me', RULES), HEADINGS_REFUSAL);
});

test('refuses an extra heading', () => {
  assert.equal(
    getBodyTextRefusal('## One\na\n## Two\nb\n## Three\nc\nBuilt\nBy me', RULES),
    HEADINGS_REFUSAL,
  );
});

test('refuses headings in the wrong order', () => {
  assert.equal(getBodyTextRefusal('## Two\nb\n## One\na\nBuilt\nBy me', RULES), HEADINGS_REFUSAL);
});

test('refuses a heading with no text under it before the next heading', () => {
  assert.equal(getBodyTextRefusal('## One\n\n## Two\nb\nBuilt\nBy me', RULES), HEADINGS_REFUSAL);
});

test('refuses a last heading with only the footer under it', () => {
  assert.equal(getBodyTextRefusal('## One\na\n## Two\nBuilt\nBy me', RULES), HEADINGS_REFUSAL);
});

test('asks for no footer when the rules list none', () => {
  const rules = { headings: ['One', 'Two'], footer: [] };

  assert.equal(getBodyTextRefusal('## One\na\n## Two\nb', rules), undefined);
});
