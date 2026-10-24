import type { ReturnRow, Row } from '../record-row.ts';
import { getCompletions, type Completion } from './get-completions.ts';

// How often a builder's work was sent back: the builder completions, and
// those that received a judge's REWORK or REVISE. A return lands on the most
// recent builder completion before it in the same session, and on none when
// there is no such completion.
export interface Rework {
  readonly builders: number;
  readonly reworked: number;
}

const BUILDER = 'providens:builder';
const REWORK_VERDICTS: readonly string[] = ['REWORK', 'REVISE'];

export function getRework(rows: readonly Row[]): Rework {
  const builders = getCompletions(rows).filter((completion) => completion.subject === BUILDER);
  const landedOn = rows.filter(isReworkReturn)
    .flatMap((judge) => getLatestBefore(builders, judge) ?? []);

  return {
    builders: builders.length,
    reworked: new Set(landedOn).size,
  };
}

function getLatestBefore(
  builders: readonly Completion[],
  judge: ReturnRow,
): Completion | undefined {
  return builders
    .filter((builder) => builder.sessionId === judge.sessionId && builder.time < judge.time)
    .reduce<Completion | undefined>((latest, builder) =>
      latest === undefined || builder.time >= latest.time ? builder : latest, undefined);
}

function isReworkReturn(row: Row): row is ReturnRow {
  return row.hook === 'return' && row.verdict !== undefined
    && REWORK_VERDICTS.includes(row.verdict);
}
