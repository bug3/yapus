import { type Call, getCalls } from './calls/get-calls.ts';
import { isGitWord } from './calls/is-git-word.ts';
import { parsePayload } from './input/parse-payload.ts';
import { mentionsGit } from './mentions-git.ts';
import { type Item, splitCommands } from './shell/split-commands.ts';

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

// Empty until the rules arrive, one slice each.
export const RULES: readonly Rule[] = [];

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

  if (found.kind === 'unjudgeable') {
    return hasGitMention(command, split.items)
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

// Quotes can hide a git word from the raw text (`g''it`), so the split words
// count too; the raw text already holds every heredoc body.
function hasGitMention(command: string, items: readonly Item[]): boolean {
  return mentionsGit(command) || items.some((item) => item.kind === 'command'
    && item.words.some((word) => word.text.split(/\s+/u).some(isGitWord)));
}
