import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMonthName } from '../../../../../hooks/claude/delegator/plans/is-month-name.ts';

test('accepts a year of four digits and a month from 01 to 12', () => {
  assert.deepEqual(
    ['2026-01', '2026-09', '2026-10', '2026-12', '0001-01'].map((name) => isMonthName(name)),
    [true, true, true, true, true],
  );
});

test('rejects the months 00 and 13', () => {
  assert.deepEqual(['2026-00', '2026-13'].map((name) => isMonthName(name)), [false, false]);
});

test('rejects a month of one digit and a year that is not four digits', () => {
  assert.deepEqual(
    ['2026-1', '26-11', '20266-11'].map((name) => isMonthName(name)),
    [false, false, false],
  );
});

test('rejects a name that only starts or ends as a month', () => {
  assert.deepEqual(
    ['2026-11-15', 'x2026-11', '2026-11\n', '2026-11.md'].map((name) => isMonthName(name)),
    [false, false, false, false],
  );
});

test('rejects digits outside ASCII, another separator and the empty name', () => {
  assert.deepEqual(
    ['٢٠٢٦-11', '2026_11', '202611', ''].map((name) => isMonthName(name)),
    [false, false, false, false],
  );
});
