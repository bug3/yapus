import type { EndRow, ResumeRow, ReturnRow, Row } from '../record-row.ts';

// One subagent that finished: it has a return row, or an end row that
// completed. A total comes from the end row first, then from the last return
// that has it: a sent-back agent returns twice, and a transcript the hook
// could not read leaves a return without totals. A launch is capped when its
// end carries the cap note or, for a background launch, when a resume of it
// follows a cap stop.
export interface Completion {
  readonly agentId: string;
  readonly subject: string;
  readonly sessionId: string;
  readonly time: string;
  readonly durationMs: number | undefined;
  readonly tokens: number | undefined;
  readonly toolUses: number | undefined;
  readonly capped: boolean;
}

export function getCompletions(rows: readonly Row[]): Completion[] {
  const ends = rows.filter(isCompletedEnd);
  const returns = rows.filter(isReturnWithAgentId);
  const agentIds = [...new Set([...ends, ...returns].map((row) => row.agentId))];

  return agentIds.flatMap((agentId) => {
    const end = ends.find((row) => row.agentId === agentId);
    const own = returns.filter((row) => row.agentId === agentId);
    const source = end ?? own.at(-1);

    return source === undefined ? [] : [{
      agentId,
      subject: source.subject,
      sessionId: source.sessionId,
      time: source.time,
      durationMs: end?.durationMs
        ?? own.findLast((row) => row.durationMs !== undefined)?.durationMs,
      tokens: end?.tokens ?? own.findLast((row) => row.tokens !== undefined)?.tokens,
      toolUses: end?.toolUses ?? own.findLast((row) => row.toolUses !== undefined)?.toolUses,
      capped: (end?.capped ?? false)
        || (isBackgroundLaunch(rows, agentId) && isResumedAfterCapStop(rows, agentId)),
    }];
  });
}

// Only a background launch needs the resume rule: a foreground one carries the
// cap note on its end, and return rows exist for delegator agents alone.
function isBackgroundLaunch(rows: readonly Row[], agentId: string): boolean {
  return rows.some((row) =>
    row.hook === 'end' && row.agentId === agentId && row.status === 'async_launched');
}

// A background subagent that hits its turn cap fires no stop hook, so the
// record shows it only when the session resumes it. The rows of one agent id,
// in append order, are cut by its resumes into runs; a resume follows a cap
// stop when the run before it holds no allowed return (a refused return keeps
// the subagent running).
function isResumedAfterCapStop(rows: readonly Row[], agentId: string): boolean {
  const { hasCapStop } = rows.filter((row) => isRunEvent(row, agentId)).reduce(
    (state, row) => (row.hook === 'resume'
      ? { hasReturn: false, hasCapStop: state.hasCapStop || !state.hasReturn }
      : { hasReturn: state.hasReturn || row.allowed, hasCapStop: state.hasCapStop }),
    { hasReturn: false, hasCapStop: false },
  );

  return hasCapStop;
}

function isRunEvent(row: Row, agentId: string): row is ResumeRow | ReturnRow {
  return (row.hook === 'resume' || row.hook === 'return') && row.agentId === agentId;
}

// End rows that did not complete and whose agent never returned: a subagent
// that stopped in silence.
export function getSilentEnds(rows: readonly Row[]): EndRow[] {
  const returned = new Set(rows.filter(isReturnWithAgentId).map((row) => row.agentId));

  return rows.filter((row): row is EndRow =>
    row.hook === 'end' && row.status !== 'completed' && !returned.has(row.agentId));
}

function isCompletedEnd(row: Row): row is EndRow {
  return row.hook === 'end' && row.status === 'completed';
}

function isReturnWithAgentId(row: Row): row is ReturnRow & { readonly agentId: string } {
  return row.hook === 'return' && row.agentId !== undefined;
}
