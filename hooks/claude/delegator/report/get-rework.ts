import type { ReturnWords } from '../contract/read-return-words.ts';
import type { EndRow, LaunchRow, ReturnRow, Row } from '../record-row.ts';
import { getCompletions, type Completion } from './get-completions.ts';

// How often a builder's or a finisher's work was sent back: their
// completions, and those that received a judge's verdict that return-words.json
// marks as rework. A return
// whose launch names a launcher lands on that launcher when it is a finisher,
// and on nothing else. A return whose launcher is no completed finisher (one
// still running, or cut off in the background and never resumed) lands on
// nothing. A return of a launch by the main agent lands on the most recent
// builder completion before it in the same session, and on none when there
// is no such completion.
export interface Rework {
  readonly builders: number;
  readonly reworked: number;
  readonly finishers: number;
  readonly reworkedFinishers: number;
}

const BUILDER = 'delegator:builder';
const FINISHER = 'delegator:finisher';

export function getRework(rows: readonly Row[], words: ReturnWords): Rework {
  const completions = getCompletions(rows);
  const builders = completions.filter((completion) => completion.subject === BUILDER);
  const finishers = completions.filter((completion) => completion.subject === FINISHER);
  const landedOn = new Set(rows.filter((row) => isReworkReturn(row, words))
    .flatMap((judge) => getLandedOn(rows, completions, judge) ?? []));

  return {
    builders: builders.length,
    reworked: builders.filter((builder) => landedOn.has(builder)).length,
    finishers: finishers.length,
    reworkedFinishers: finishers.filter((finisher) => landedOn.has(finisher)).length,
  };
}

function getLandedOn(
  rows: readonly Row[],
  completions: readonly Completion[],
  judge: ReturnRow,
): Completion | undefined {
  const callerId = getCallerId(rows, judge);

  return callerId === undefined
    ? getLatestBefore(completions.filter((completion) => completion.subject === BUILDER), judge)
    : completions.find((completion) =>
      completion.subject === FINISHER && completion.agentId === callerId);
}

// The launch row of a return is reached through its end row: the end row
// shares the agent id with the return and the call id with the launch.
function getCallerId(rows: readonly Row[], judge: ReturnRow): string | undefined {
  const end = rows.find((row): row is EndRow =>
    row.hook === 'end' && row.agentId === judge.agentId && row.toolUseId !== undefined);
  const launch = end === undefined
    ? undefined
    : rows.find((row): row is LaunchRow =>
      row.hook === 'launch' && row.toolUseId === end.toolUseId);

  return launch?.callerId;
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

function isReworkReturn(row: Row, words: ReturnWords): row is ReturnRow {
  return row.hook === 'return' && row.verdict !== undefined
    && words.reworkVerdicts.includes(row.verdict);
}
