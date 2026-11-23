import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readStoredDescription,
} from '../../../../../../hooks/claude/delegator/memory/migrate/read-stored-description.ts';

test('reads the description of a stored topic file, with or without quotes around it', () => {
  assert.deepEqual(
    [
      readStoredDescription('---\nname: a\ndescription: The a rule, for a calls\n---\n\nDo a.\n'),
      readStoredDescription('---\ndescription: "The \\"a\\" rule"\n---\n'),
      readStoredDescription("---\ndescription: 'It''s the a rule'\n---\n"),
    ],
    ['The a rule, for a calls', 'The "a" rule', "It's the a rule"],
  );
});

test('reads no description from a block scalar, whose text stands under its line', () => {
  const headers = ['>-', '>', '|', '|+', '>2', '|2-'];

  assert.deepEqual(
    headers.map((header) => (
      readStoredDescription(`---\ndescription: ${ header }\n  The a rule,\n  for a calls\n---\n`)
    )),
    headers.map(() => ''),
  );
});

test('reads no description from a text with CRLF line ends', () => {
  assert.equal(readStoredDescription('---\r\ndescription: The a rule\r\n---\r\nDo a.\r\n'), '');
});

test('reads no description from a text with no frontmatter or with no such line in it', () => {
  assert.deepEqual(
    [
      readStoredDescription('No frontmatter.\n---\ndescription: in the body\n'),
      readStoredDescription('---\nname: a\nmetadata:\n  description: under a key\n---\n'),
      readStoredDescription('---\ndescription:\n---\n'),
      readStoredDescription('---\ndescription: ""\n---\n'),
    ],
    ['', '', '', ''],
  );
});
