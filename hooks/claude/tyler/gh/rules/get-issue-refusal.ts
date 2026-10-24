import type { Word } from '../shell/split-commands.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import type { GhCatalogs } from './read-gh-catalogs.ts';
import { ghCommands } from './gh-commands.ts';
import { getIssueTitleRefusal } from './issue/get-issue-title-refusal.ts';
import { readIssueLabels } from './issue/read-issue-labels.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { isHelpRequest } from './options/is-help-request.ts';
import { readGhArguments } from './read-gh-arguments.ts';

const spec = ghCommands.actions.issueCreate;

// A reason to refuse a `gh issue create` whose options, title, labels or body
// file break the rules, or undefined. `words` follow the action; `cwd` is the
// directory a relative body file resolves against, undefined when unknown;
// `catalogs` judge the title and the labels.
export function getIssueRefusal(
  words: readonly Word[],
  cwd: string | undefined,
  catalogs: GhCatalogs,
): string | undefined {
  const args = readGhArguments(words, spec);

  if ('refusal' in args) {
    return args.refusal;
  }

  if (isHelpRequest(args)) {
    return undefined;
  }

  const { command } = spec;
  const refusal = getForbiddenOptionRefusal(args, command)
    ?? getIssueTitleRefusal(args, command, catalogs);

  if (refusal !== undefined) {
    return refusal;
  }

  const labels = readIssueLabels(args, command, catalogs);

  return 'refusal' in labels
    ? labels.refusal
    : getBodyRefusal(args, { command, rules: labels.rules, cwd });
}
