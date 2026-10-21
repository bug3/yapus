import type { Word } from '../shell/split-commands.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import { ghCommands } from './gh-commands.ts';
import { getIssueTitleRefusal } from './issue/get-issue-title-refusal.ts';
import { readIssueLabels } from './issue/read-issue-labels.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { isHelpRequest } from './options/is-help-request.ts';
import { readGhArguments } from './read-gh-arguments.ts';

const spec = ghCommands.actions.issueCreate;

// A reason to refuse a `gh issue create` whose options, title, labels or body
// file break the rules, or undefined. `words` follow the action; `cwd` is the
// directory a relative body file resolves against, undefined when unknown.
export function getIssueRefusal(
  words: readonly Word[],
  cwd: string | undefined,
): string | undefined {
  const args = readGhArguments(words, spec);

  if ('refusal' in args) {
    return args.refusal;
  }

  if (isHelpRequest(args)) {
    return undefined;
  }

  const { command } = spec;
  const refusal = getForbiddenOptionRefusal(args, command) ?? getIssueTitleRefusal(args, command);

  if (refusal !== undefined) {
    return refusal;
  }

  const labels = readIssueLabels(args, command);

  return 'refusal' in labels
    ? labels.refusal
    : getBodyRefusal(args, { command, rules: labels.rules, cwd });
}
