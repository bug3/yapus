import type { LaunchRow, ReturnRow, Row } from '../record-row.ts';

// Every reason a launch or a return was refused, with its count, most
// frequent first.
export function getRefusals(rows: readonly Row[]): [string, number][] {
  const reasons = rows
    .filter(isRefused)
    .map((row) => (row.hook === 'return' ? 'return over the cap' : row.reason));
  const counts = reasons.reduce<Record<string, number>>(
    (tally, reason) => ({ ...tally, [reason]: (tally[reason] ?? 0) + 1 }),
    {},
  );

  return Object.entries(counts).sort(([, left], [, right]) => right - left);
}

function isRefused(row: Row): row is LaunchRow | ReturnRow {
  return row.hook !== 'end' && !row.allowed;
}
