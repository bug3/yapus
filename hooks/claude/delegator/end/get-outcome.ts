import { recordRow } from '../record-row.ts';
import { parseEnd } from './parse-end.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  readonly time: string;
}

export type Outcome =
  | { readonly kind: 'recorded' }
  | { readonly kind: 'failure'; readonly detail: string };

// Records the end of the launch in stdin as one row, or says why it cannot;
// the hook judges nothing, the launch has already ended.
export function getOutcome(input: Input): Outcome {
  if (input.dataDir === undefined || input.dataDir === '') {
    return { kind: 'failure', detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin' };
  }

  const parsed = parseEnd(input.stdinText);

  if (parsed.kind === 'failure') {
    return { kind: 'failure', detail: `${ parsed.reason }; the end is not recorded` };
  }

  const { end } = parsed;

  recordRow(input.dataDir, {
    time: input.time,
    hook: 'end',
    sessionId: end.sessionId,
    subject: end.agentType,
    promptId: end.promptId,
    toolUseId: end.toolUseId,
    agentId: end.agentId,
    status: end.status,
    model: end.model,
    durationMs: end.durationMs,
    tokens: end.tokens,
    toolUses: end.toolUses,
    word: end.word,
    length: end.length,
    capped: end.isCapped,
  });

  return { kind: 'recorded' };
}
