import { type Call, getCalls } from './calls/get-calls.ts';
import { parsePayload } from './input/parse-payload.ts';
import { mentionsGit } from './mentions-git.ts';
import { getDestructiveRefusal } from './rules/destructive/get-destructive-refusal.ts';
import { splitCommands } from './shell/split-commands.ts';

export interface Input {
  readonly stdinText: string;
  readonly home: string | undefined;
}

export interface Allow {
  readonly kind: 'allow';
}

export interface Deny {
  readonly kind: 'deny';
  readonly detail: string;
}

export type Verdict = Allow | Deny;

// A refusal reason for the call, or undefined when the rule has no objection.
export type Rule = (call: Call) => string | undefined;

// One rule per slice.
export const RULES: readonly Rule[] = [getDestructiveRefusal];

const ALLOW: Allow = { kind: 'allow' };

// Whether the Bash call in stdin may run. A call the gate cannot read is
// refused only when its text mentions git or gh.
export function getVerdict(input: Input): Verdict {
  const payload = parsePayload(input.stdinText);

  if (payload.kind === 'other') {
    return ALLOW;
  }

  if (payload.kind === 'failure') {
    return deny(`cannot read the tool call: ${ payload.reason }`);
  }

  const { command } = payload;
  const split = splitCommands(command, input.home);

  if (split.kind === 'failure') {
    return mentionsGit(command) ? deny(`cannot read the command: ${ split.reason }`) : ALLOW;
  }

  const found = getCalls(split.items, input.home);

  // When the unread part could be the program itself, the text cannot clear it.
  if (found.kind === 'unjudgeable') {
    return found.shouldAlwaysDeny || mentionsGit(command)
      ? deny(`cannot judge a git or gh call: ${ found.reason }`)
      : ALLOW;
  }

  for (const call of found.calls) {
    for (const rule of RULES) {
      const reason = rule(call);

      if (reason !== undefined) {
        return deny(reason);
      }
    }
  }

  return ALLOW;
}

function deny(detail: string): Deny {
  return { kind: 'deny', detail };
}
