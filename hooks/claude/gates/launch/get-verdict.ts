import { admitLaunch } from './admit-launch.ts';
import { getRefusal } from './get-refusal.ts';
import { recordRow } from '../../providens/record-row.ts';
import { type Launch, parseLaunch } from './parse-launch.ts';
import { readMode } from '../../providens/settings/read-mode.ts';

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
  const reason = getReason(input.dataDir, launch);

  recordRow(input.dataDir, {
    time: input.time,
    hook: 'launch',
    sessionId: launch.sessionId,
    subject: launch.subagentType,
    allowed: reason === undefined,
    reason: reason ?? '',
    description: launch.description,
    toolUseId: launch.toolUseId,
    promptId: launch.promptId,
    model: launch.model,
    effort: launch.effort,
    callerId: launch.caller?.agentId,
  });

  return reason === undefined ? { kind: 'allow' } : { kind: 'deny', detail: reason };
}

// Why the launch is refused, or undefined. In off nothing is checked or
// counted, so the session keeps its budget for when the person switches on.
function getReason(dataDir: string, launch: Launch): string | undefined {
  const mode = readMode(dataDir, launch.sessionId);

  if (mode.kind === 'invalid') {
    return `${ mode.path } holds no mode; the person writes on or off there`;
  }

  if (mode.value === 'off') {
    return undefined;
  }

  return getRefusal(launch) ?? admitLaunch(dataDir, launch.sessionId);
}
