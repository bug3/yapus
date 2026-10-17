import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFinding } from '../../../hooks/dashes/format-finding.ts';
import type { Finding } from '../../../hooks/dashes/get-findings.ts';

const LINE_SEPARATOR = String.fromCodePoint(0x2028);

test('formats a finding at a file line', () => {
  const finding: Finding = {
    filePath: '/r/a.md',
    place: { kind: 'file', line: 4 },
    dashes: [0x2014, 0x2013],
  };

  assert.equal(
    formatFinding(finding),
    'yapus dashes: /r/a.md:4: U+2014, U+2013; use the ASCII hyphen',
  );
});

test('formats a finding at a new_string line', () => {
  const finding: Finding = {
    filePath: '/r/a.md',
    place: { kind: 'new_string', line: 1 },
    dashes: [0x10d6e],
  };

  assert.equal(
    formatFinding(finding),
    'yapus dashes: /r/a.md: new_string line 1: U+10D6E; use the ASCII hyphen',
  );
});

test('writes a line feed in the path as its code point', () => {
  const finding: Finding = {
    filePath: '/r/a\nb.md',
    place: { kind: 'file', line: 1 },
    dashes: [0x2014],
  };

  assert.equal(
    formatFinding(finding),
    'yapus dashes: /r/a<U+000A>b.md:1: U+2014; use the ASCII hyphen',
  );
});

test('writes a line separator in the path as its code point', () => {
  const finding: Finding = {
    filePath: `/r/a${ LINE_SEPARATOR }b.md`,
    place: { kind: 'file', line: 1 },
    dashes: [0x2014],
  };

  assert.equal(
    formatFinding(finding),
    'yapus dashes: /r/a<U+2028>b.md:1: U+2014; use the ASCII hyphen',
  );
});
