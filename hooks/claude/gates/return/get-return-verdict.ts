import { RETURN_CAP_CHARACTERS } from '../../delegator/contract/get-context.ts';
import type { ReturnRow } from '../../delegator/record-row.ts';
import { recordRow } from '../../delegator/record-row.ts';
import type { TranscriptStats } from './get-transcript-stats.ts';
import { readTranscriptStats } from './get-transcript-stats.ts';
import { isWorkflowAgent } from './is-workflow-agent.ts';
import { MISSING_FIELDS, parseStop } from './parse-stop.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA; without it the stop is judged but not logged, as
  // blocking would send every subagent back for good.
  readonly dataDir: string | undefined;
  readonly time: string;
}

export type ReturnVerdict =
  | { readonly kind: 'pass' }
  | { readonly kind: 'shorten'; readonly detail: string };

// Whether the subagent's return may reach the session: within the cap,
// or past it on the second try, which passes so the subagent cannot loop. A
// workflow agent returns to its script and stops with no message, so its
// stop passes with nothing judged and nothing logged.
export function getReturnVerdict(input: Input): ReturnVerdict {
  const parsed = parseStop(input.stdinText);

  if (parsed.kind === 'failure') {
    return { kind: 'shorten', detail: `${ parsed.reason }; the stop is blocked` };
  }

  const { stop } = parsed;
  const { message } = stop;

  if (stop.transcriptPath !== undefined && isWorkflowAgent(stop.transcriptPath)) {
    return { kind: 'pass' };
  }

  if (message === undefined) {
    return { kind: 'shorten', detail: `${ MISSING_FIELDS }; the stop is blocked` };
  }

  const { length } = message;
  const isOver = length > RETURN_CAP_CHARACTERS;
  const isSentBack = isOver && !stop.isRetry;

  if (input.dataDir !== undefined && input.dataDir !== '') {
    recordRow(input.dataDir, {
      time: input.time,
      hook: 'return',
      sessionId: stop.sessionId,
      subject: stop.agentType,
      allowed: !isSentBack,
      reason: isOver ? `${ String(length) } characters` : '',
      agentId: stop.agentId,
      status: getFirstWord(message, 0) ?? '',
      verdict: getFirstWord(message, 1),
      length,
      ...getTotals(readTranscriptStats(stop.transcriptPath)),
    });
  }

  return isSentBack
    ? {
      kind: 'shorten',
      detail: `the return has ${ String(length) } characters, over the cap of `
        + `${ String(RETURN_CAP_CHARACTERS) }; return the most useful part, say what was cut `
        + 'and name the follow-up questions',
    }
    : { kind: 'pass' };
}

// The first word of the message's non-empty line at index, or undefined
// when the message has fewer lines.
function getFirstWord(message: string, index: number): string | undefined {
  const lines = message.split('\n').map((line) => line.trim()).filter((line) => line !== '');

  return lines[index]?.split(/\s+/u)[0];
}

function getTotals(stats: TranscriptStats | undefined): Pick<ReturnRow, keyof TranscriptStats> {
  return {
    turns: stats?.turns,
    toolUses: stats?.toolUses,
    tokens: stats?.tokens,
    durationMs: stats?.durationMs,
    model: stats?.model,
  };
}
