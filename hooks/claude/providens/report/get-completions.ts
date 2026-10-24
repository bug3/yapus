import type { EndRow, ReturnRow, Row } from '../record-row.ts';

// One subagent that finished: it has a return row, or an end row that
// completed. The totals come from the end row first, then from the return.
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
  const returns = rows.filter(hasAgentId);
  const agentIds = [...new Set(rows.flatMap((row) => (isCompletedEnd(row) || hasAgentId(row)
    ? [row.agentId]
    : [])))];

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
      capped: end?.capped ?? false,
    }];
  });
}

// End rows that did not complete and whose agent never returned: a subagent
// that stopped in silence.
export function getSilentEnds(rows: readonly Row[]): EndRow[] {
  const returned = new Set(rows.filter(hasAgentId).map((row) => row.agentId));

  return rows.filter((row): row is EndRow =>
    row.hook === 'end' && row.status !== 'completed' && !returned.has(row.agentId));
}

function isCompletedEnd(row: Row): row is EndRow {
  return row.hook === 'end' && row.status === 'completed';
}

function hasAgentId(row: Row): row is ReturnRow & { readonly agentId: string } {
  return row.hook === 'return' && row.agentId !== undefined;
}
