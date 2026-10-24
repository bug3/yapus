import { RETURN_CAP_CHARACTERS } from '../../providens/contract/get-context.ts';
import { recordRow } from '../../providens/record-row.ts';
import { parseStop } from './parse-stop.ts';

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

// Whether the subagent's return may reach the main session: within the cap,
// or past it on the second try, which passes so the subagent cannot loop.
export function getReturnVerdict(input: Input): ReturnVerdict {
  const parsed = parseStop(input.stdinText);

  if (parsed.kind === 'failure') {
    return { kind: 'shorten', detail: `${ parsed.reason }; the stop is blocked` };
  }

  const { stop } = parsed;
  const { length } = stop.message;
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
