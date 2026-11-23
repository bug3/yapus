import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readFrontmatter,
} from '../../../../../hooks/claude/delegator/memory/read-frontmatter.ts';

test('reads each key: "text" line as a field and the text under them as the body', () => {
  const read = readFrontmatter(
    '---\ndescription: "What it holds"\nevent: "gh pr merge"\n---\n\nBody\n',
  );

  assert.deepEqual(
    [[...read.fields], read.body],
    [[['description', 'What it holds'], ['event', 'gh pr merge']], '\nBody\n'],
  );
});

test('reads a key with a hyphen', () => {
  const read = readFrontmatter('---\nsuperseded-by: "new-rule"\n---\n');

  assert.deepEqual([...read.fields], [['superseded-by', 'new-rule']]);
});

test('reads a text from its first quote to the last one of the line, as it is written', () => {
  const read = readFrontmatter('---\ndescription: "Say "no" and \\"stop\\": then wait"\n---\n');

  assert.equal(read.fields.get('description'), 'Say "no" and \\"stop\\": then wait');
});

test('reads an empty text as an empty field', () => {
  const read = readFrontmatter('---\ndescription: ""\n---\n');

  assert.deepEqual([...read.fields], [['description', '']]);
});

test('keeps the last text of a key written twice', () => {
  const read = readFrontmatter('---\ndescription: "first"\ndescription: "second"\n---\n');

  assert.deepEqual([...read.fields], [['description', 'second']]);
});

test('skips a line without quotes, an indented line and a line with text after the quote', () => {
  const text = [
    '---',
    'name: plain',
    'metadata:',
    '  type: "nested"',
    'event: "gh pr merge" # a comment',
    'description: "kept"',
    '---',
    '',
  ].join('\n');

  assert.deepEqual([...readFrontmatter(text).fields], [['description', 'kept']]);
});

test('reads no field from the body', () => {
  const read = readFrontmatter('---\ndescription: "kept"\n---\nevent: "gh pr merge"\n---\nrest\n');

  assert.deepEqual(
    [[...read.fields], read.body],
    [[['description', 'kept']], 'event: "gh pr merge"\n---\nrest\n'],
  );
});

test('gives the whole text as the body when it does not start with the opening line', () => {
  const text = '\n---\ndescription: "late"\n---\nBody\n';

  assert.deepEqual(
    [[...readFrontmatter(text).fields], readFrontmatter(text).body],
    [[], text],
  );
});

test('gives the whole text as the body when the frontmatter is never closed', () => {
  const text = '---\ndescription: "open"\nBody\n';

  assert.deepEqual(
    [[...readFrontmatter(text).fields], readFrontmatter(text).body],
    [[], text],
  );
});

test('gives no field and an empty body for an empty text', () => {
  assert.deepEqual([[...readFrontmatter('').fields], readFrontmatter('').body], [[], '']);
});
