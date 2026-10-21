import { findGhCalls } from './calls/find-gh-calls.ts';
import { getIssueRefusal } from './rules/get-issue-refusal.ts';
import { getPrRefusal } from './rules/get-pr-refusal.ts';
import { ghCommands, type GhAction } from './rules/gh-commands.ts';
import { splitCommands, type Word } from './shell/split-commands.ts';

export interface Pass {
  readonly kind: 'pass';
}

export interface Refuse {
  readonly kind: 'refuse';
  readonly reason: string;
}

export type Verdict = Pass | Refuse;

// A reason to refuse one action's call, given the words after the action and
// the directory it runs in (undefined when unknown), or undefined.
type ActionRefusal = (words: readonly Word[], cwd: string | undefined) => string | undefined;

export const PASS: Pass = { kind: 'pass' };

const REFUSALS: Readonly<Record<GhAction, ActionRefusal>> = {
  prCreate: getPrRefusal,
  issueCreate: getIssueRefusal,
};

// The judged actions as written on a command line, for one that cannot be split;
// any run of spaces or tabs may separate the words.
const MENTIONS: readonly RegExp[] = Object.values(ghCommands.actions)
  .flatMap(({ spellings }) => spellings.map((spelling) => new RegExp(
    `gh[ \\t]+${ spelling.replaceAll(' ', '[ \\t]+') }`,
    'u',
  )));

// Whether a Bash command may run, judged from `cwd`, the absolute directory it
// starts in. Only the gh actions in the catalog are judged; a command that
// cannot be split is refused only when it mentions one of them.
export function getVerdict(command: string, cwd: string): Verdict {
  const split = splitCommands(command);

  if ('failure' in split) {
    return MENTIONS.some((mention) => mention.test(command))
      ? refuse(ghCommands.reasons.unreadableCommand(split.failure))
      : PASS;
  }

  for (const call of findGhCalls(split, cwd)) {
    const reason = REFUSALS[call.action](call.argumentWords, call.cwd);

    if (reason !== undefined) {
      return refuse(reason);
    }
  }

  return PASS;
}

export function refuse(reason: string): Refuse {
  return { kind: 'refuse', reason };
}
