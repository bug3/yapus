import { type Call, getCalls } from './calls/get-calls.ts';
import type { Context } from './context/make-context.ts';
import { parsePayload } from './input/parse-payload.ts';
import { mentionsGit } from './mentions-git.ts';
import { getBranchRefusal } from './rules/branch/get-branch-refusal.ts';
import { getBypassRefusal } from './rules/bypass/get-bypass-refusal.ts';
import { getDestructiveRefusal } from './rules/destructive/get-destructive-refusal.ts';
import { getUnknownRefusal } from './rules/known/get-unknown-refusal.ts';
import { getOwnLineRefusal } from './rules/gh/get-own-line-refusal.ts';
import { getReadyCheck } from './rules/gh/checks/get-ready-check.ts';
import { getSizeCheck } from './rules/gh/checks/get-size-check.ts';
import { getGhWriteRefusal } from './rules/gh/get-gh-write-refusal.ts';
import { getIssueRefusal } from './rules/gh/get-issue-refusal.ts';
import { getMergeRefusal } from './rules/gh/get-merge-refusal.ts';
import { getMisplacedOptionRefusal } from './rules/gh/get-misplaced-option-refusal.ts';
import { getPrRefusal } from './rules/gh/get-pr-refusal.ts';
import { getPushRefusal } from './rules/push/get-push-refusal.ts';
import { splitCommands } from './shell/split-commands.ts';

export interface Input {
  readonly stdinText: string;
  readonly home: string | undefined;
}

// `notes` is absent when there are none; the hook shows them to Claude.
export interface Allow {
  readonly kind: 'allow';
  readonly notes?: readonly string[];
}

export interface Deny {
  readonly kind: 'deny';
  readonly detail: string;
}

export type Verdict = Allow | Deny;

// A refusal reason for the call, or undefined when the rule has no objection.
export type Rule = (call: Call) => string | undefined;

// What a check finds in a call: a refusal, a note that lets the call run, or nothing.
export type CheckResult = { readonly refusal: string } | { readonly note: string } | undefined;

// A rule that needs the world (the working directory, git, gh) or may only note.
export type Check = (call: Call, context: Context) => CheckResult;

// One rule per slice.
export const RULES: readonly Rule[] = [
  getUnknownRefusal,
  getDestructiveRefusal,
  getBypassRefusal,
  getPushRefusal,
  getBranchRefusal,
  getMisplacedOptionRefusal,
  getPrRefusal,
  getIssueRefusal,
  getMergeRefusal,
  getGhWriteRefusal,
];

// The checks run after RULES, for each call.
export const CHECKS: readonly Check[] = [getSizeCheck, getReadyCheck];

const ALLOW: Allow = { kind: 'allow' };

// The context of a caller that gives none: nothing runs.
function makeNothingRuns(cwd: string | undefined): Context {
  return { cwd, run: () => ({ failure: 'the gate runs nothing here' }) };
}

// Whether the Bash call in stdin may run. A call the gate cannot read is
// refused only when its text mentions git or gh.
export function getVerdict(
  input: Input,
  given?: Context,
  checks: readonly Check[] = CHECKS,
): Verdict {
  const payload = parsePayload(input.stdinText);

  if (payload.kind === 'other') {
    return ALLOW;
  }

  if (payload.kind === 'failure') {
    return deny(`cannot read the tool call: ${ payload.reason }`);
  }

  const { command } = payload;
  const context = given ?? makeNothingRuns(payload.cwd);
  const notes: string[] = [];
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
    const lineReason = getOwnLineRefusal(call, split.items);

    if (lineReason !== undefined) {
      return deny(lineReason);
    }

    for (const rule of RULES) {
      const reason = rule(call);

      if (reason !== undefined) {
        return deny(reason);
      }
    }

    for (const check of checks) {
      const result = check(call, context);

      if (result !== undefined && 'refusal' in result) {
        return deny(result.refusal);
      }

      if (result !== undefined) {
        notes.push(result.note);
      }
    }
  }

  return notes.length === 0 ? ALLOW : { kind: 'allow', notes };
}

function deny(detail: string): Deny {
  return { kind: 'deny', detail };
}
