import type { EndRow, ReturnRow, Row } from '../record-row.ts';

// How often a builder's work was sent back: the completed builder ends, and
// those followed in the same session by a judge's REWORK or REVISE.
export interface Rework {
  readonly builders: number;
  readonly reworked: number;
}

const BUILDER = 'providens:builder';
const REWORK_VERDICTS: readonly string[] = ['REWORK', 'REVISE'];

export function getRework(rows: readonly Row[]): Rework {
  const builderEnds = rows.filter(isCompletedBuilderEnd);
  const reworkReturns = rows.filter(isReworkReturn);

  return {
    builders: builderEnds.length,
    reworked: builderEnds.filter((end) => reworkReturns.some((judge) =>
      judge.sessionId === end.sessionId && judge.time > end.time)).length,
  };
}

function isCompletedBuilderEnd(row: Row): row is EndRow {
  return row.hook === 'end' && row.subject === BUILDER && row.status === 'completed';
}

function isReworkReturn(row: Row): row is ReturnRow {
  return row.hook === 'return' && row.verdict !== undefined
    && REWORK_VERDICTS.includes(row.verdict);
}
