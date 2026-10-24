import { admitLaunch } from './admit-launch.ts';
import { getRefusal } from './get-refusal.ts';
import { recordRow } from '../../providens/record-row.ts';
import { parseLaunch } from './parse-launch.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  readonly time: string;
}

export type Verdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly detail: string };

// Whether the Agent call in stdin may launch: it keeps the roster's rules
// and fits the session's budget. Every judged launch is logged; one that
// cannot be judged is denied.
export function getVerdict(input: Input): Verdict {
  if (input.dataDir === undefined || input.dataDir === '') {
    return { kind: 'deny', detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin' };
  }

  const parsed = parseLaunch(input.stdinText);

  if (parsed.kind === 'failure') {
    return { kind: 'deny', detail: `${ parsed.reason }; the launch is blocked` };
  }

  const { launch } = parsed;
  const reason = getRefusal(launch) ?? admitLaunch(input.dataDir, launch.sessionId);

  recordRow(input.dataDir, {
    time: input.time,
    hook: 'launch',
    sessionId: launch.sessionId,
    subject: launch.subagentType,
    allowed: reason === undefined,
    reason: reason ?? '',
  });

  return reason === undefined ? { kind: 'allow' } : { kind: 'deny', detail: reason };
}
