import { recordRow } from '../record-row.ts';
import { parseResume } from './parse-resume.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  readonly time: string;
}

export type Outcome =
  | { readonly kind: 'recorded' }
  | { readonly kind: 'skipped' }
  | { readonly kind: 'failure'; readonly detail: string };

// Records the resume in stdin as one row, or says why it cannot; a message
// that resumed nothing records nothing, and the hook judges nothing.
export function getOutcome(input: Input): Outcome {
  if (input.dataDir === undefined || input.dataDir === '') {
    return { kind: 'failure', detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin' };
  }

  const parsed = parseResume(input.stdinText);

  if (parsed.kind === 'failure') {
    return { kind: 'failure', detail: `${ parsed.reason }; the resume is not recorded` };
  }

  if (parsed.kind === 'none') {
    return { kind: 'skipped' };
  }

  const { resume } = parsed;

  recordRow(input.dataDir, {
    time: input.time,
    hook: 'resume',
    sessionId: resume.sessionId,
    agentId: resume.agentId,
    toolUseId: resume.toolUseId,
  });

  return { kind: 'recorded' };
}
