import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeTempDir } from './make-temp-dir.ts';
import { readUtf8 } from './read-utf8.ts';

const E_ACUTE = String.fromCodePoint(0xe9);
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

test('reads a UTF-8 file', (t) => {
  const path = join(makeTempDir(t), 'a.md');

  writeFileSync(path, `caf${ E_ACUTE }\n`);

  assert.equal(readUtf8(path), `caf${ E_ACUTE }\n`);
});

test('returns undefined for a byte that is not UTF-8', (t) => {
  const path = join(makeTempDir(t), 'a.json');

  writeFileSync(path, Buffer.from([0x7b, 0xff, 0x7d]));

  assert.equal(readUtf8(path), undefined);
});

test('returns undefined for UTF-16 text without a byte order mark', (t) => {
  const path = join(makeTempDir(t), 'a.md');

  writeFileSync(path, Buffer.from('a b\n', 'utf16le'));

  assert.equal(readUtf8(path), undefined);
});

test('keeps a byte order mark in the text', (t) => {
  const path = join(makeTempDir(t), 'a.json');

  writeFileSync(path, Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]));

  assert.equal(readUtf8(path), `${ BYTE_ORDER_MARK }{}`);
});
