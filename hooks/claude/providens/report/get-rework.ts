import type { ReturnRow, Row } from '../record-row.ts';
import { getCompletions } from './get-completions.ts';

// How often a builder's work was sent back: the builder completions, and
// those followed in the same session by a judge's REWORK or REVISE.
export interface Rework {
  readonly builders: number;
  readonly reworked: number;
}

const BUILDER = 'providens:builder';
const REWORK_VERDICTS: readonly string[] = ['REWORK', 'REVISE'];

export function getRework(rows: readonly Row[]): Rework {
  const builders = getCompletions(rows).filter((completion) => completion.subject === BUILDER);
  const reworkReturns = rows.filter(isReworkReturn);

  return {
    builders: builders.length,
    reworked: builders.filter((builder) => reworkReturns.some((judge) =>
      judge.sessionId === builder.sessionId && judge.time > builder.time)).length,
  };
}

function isReworkReturn(row: Row): row is ReturnRow {
  return row.hook === 'return' && row.verdict !== undefined
    && REWORK_VERDICTS.includes(row.verdict);
}
