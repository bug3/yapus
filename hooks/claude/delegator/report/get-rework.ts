import type { ReturnWords } from '../contract/read-return-words.ts';
import type { EndRow, LaunchRow, ReturnRow, Row } from '../record-row.ts';
import { getCompletions, type Completion } from './get-completions.ts';

// How often a builder's or a finisher's work was sent back: their
// completions, and those that received a judge's verdict that return-words.json
// marks as rework. A return
// whose launch names a launcher lands on that launcher when it is a finisher,
// and on nothing else. A return whose launcher is no completed finisher (one
// still running, or cut off in the background and never resumed) lands on
// nothing. A return of a launch by the main agent at deep depth judges a whole
// plan and lands on nothing; one at another depth, or one whose launch row
// cannot be reached, lands on the most recent builder completion before it in
// the same session, and on none when there is no such completion. Only a
// finisher with an allowed diff-reviewer launch of its own counts, whatever
// kept the others from launching one, such as a slice that changed only files
// in the plan's directory. A plan
// review is a diff-reviewer completion of a deep launch by the main agent.
export interface Rework {
  readonly builders: number;
  readonly reworked: number;
  readonly finishers: number;
  readonly reworkedFinishers: number;
  readonly planReviews: number;
  readonly reworkedPlanReviews: number;
}

const BUILDER = 'delegator:builder';
const FINISHER = 'delegator:finisher';
const DIFF_REVIEWER = 'delegator:diff-reviewer';
const DEEP = '[deep]';

export function getRework(rows: readonly Row[], words: ReturnWords): Rework {
  const completions = getCompletions(rows);
  const builders = completions.filter((completion) => completion.subject === BUILDER);
  const finishers = completions.filter((completion) => completion.subject === FINISHER
    && hasLaunchedReviewer(rows, completion.agentId));
  const judges = rows.filter((row) => isReworkReturn(row, words));
  const landedOn = new Set(judges.flatMap((judge) => getLandedOn(rows, completions, judge) ?? []));
  const planReviews = completions.filter((completion) => completion.subject === DIFF_REVIEWER
    && isPlanLaunch(getLaunch(rows, completion.agentId)));
  const sentBack = new Set(judges.map((judge) => judge.agentId));

  return {
    builders: builders.length,
    reworked: builders.filter((builder) => landedOn.has(builder)).length,
    finishers: finishers.length,
    reworkedFinishers: finishers.filter((finisher) => landedOn.has(finisher)).length,
    planReviews: planReviews.length,
    reworkedPlanReviews: planReviews.filter((review) => sentBack.has(review.agentId)).length,
  };
}

function getLandedOn(
  rows: readonly Row[],
  completions: readonly Completion[],
  judge: ReturnRow,
): Completion | undefined {
  const launch = getLaunch(rows, judge.agentId);
  const callerId = launch?.callerId;

  if (isPlanLaunch(launch)) {
    return undefined;
  }

  return callerId === undefined
    ? getLatestBefore(completions.filter((completion) => completion.subject === BUILDER), judge)
    : completions.find((completion) =>
      completion.subject === FINISHER && completion.agentId === callerId);
}

function hasLaunchedReviewer(rows: readonly Row[], agentId: string): boolean {
  return rows.some((row) => row.hook === 'launch' && row.allowed
    && row.subject === DIFF_REVIEWER && row.callerId === agentId);
}

// The launch row of an agent is reached through its end row: the end row
// shares the agent id with the return and the call id with the launch.
function getLaunch(rows: readonly Row[], agentId: string | undefined): LaunchRow | undefined {
  const end = rows.find((row): row is EndRow =>
    row.hook === 'end' && row.agentId === agentId && row.toolUseId !== undefined);

  return end === undefined
    ? undefined
    : rows.find((row): row is LaunchRow =>
      row.hook === 'launch' && row.toolUseId === end.toolUseId);
}

// A deep launch by the main agent: the judge of a whole plan, which the
// write-plan skill launches after the last slice or in the plan stage.
function isPlanLaunch(launch: LaunchRow | undefined): boolean {
  return launch !== undefined && launch.callerId === undefined
    && launch.description.startsWith(DEEP);
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
