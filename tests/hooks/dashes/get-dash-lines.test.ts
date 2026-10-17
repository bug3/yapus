import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DASHES, getDashLines } from '../../../hooks/dashes/get-dash-lines.ts';

const EN_DASH = String.fromCodePoint(0x2013);
const EM_DASH = String.fromCodePoint(0x2014);
const FIGURE_DASH = String.fromCodePoint(0x2012);
const FULLWIDTH_HYPHEN = String.fromCodePoint(0xff0d);

test('lists 26 distinct code points', () => {
  assert.equal(new Set(DASHES).size, 26);
});

test('lists only dash punctuation other than the ASCII hyphen', () => {
  assert.match(String.fromCodePoint(...DASHES), /^(?!.*-)\p{Pd}{26}$/u);
});

test('finds nothing in text with only ASCII hyphens', () => {
  assert.deepEqual(getDashLines('a - b\nc-d\n'), []);
});

test('finds an em dash on its line', () => {
  assert.deepEqual(getDashLines(`a\nb ${ EM_DASH } c\n`), [{ line: 2, dashes: [0x2014] }]);
});

test('finds an en dash on its line', () => {
  assert.deepEqual(getDashLines(`5${ EN_DASH }10\n`), [{ line: 1, dashes: [0x2013] }]);
});

test('finds a dash other than the em and en dash', () => {
  assert.deepEqual(getDashLines(`x${ FULLWIDTH_HYPHEN }y`), [{ line: 1, dashes: [0xff0d] }]);
});

test('lists each dash of a line once, in order of first appearance', () => {
  const lines = getDashLines(`${ FIGURE_DASH }${ EM_DASH }${ FIGURE_DASH }${ EN_DASH }`);

  assert.deepEqual(lines, [{ line: 1, dashes: [0x2012, 0x2014, 0x2013] }]);
});

test('reports one line for each line that holds a dash', () => {
  const lines = getDashLines(`${ EM_DASH }\nclean\n${ EN_DASH }`);

  assert.deepEqual(lines, [
    { line: 1, dashes: [0x2014] },
    { line: 3, dashes: [0x2013] },
  ]);
});

test('counts lines by line feed and keeps a carriage return in its line', () => {
  assert.deepEqual(getDashLines(`a\r\nb${ EM_DASH }\r\n`), [{ line: 2, dashes: [0x2014] }]);
});
