import type { Call } from '../../calls/get-calls.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import { getGhAction } from './get-gh-action.ts';
import { ghCommands } from './gh-commands.ts';
import { getIssueTitleRefusal } from './issue/get-issue-title-refusal.ts';
import { readIssueEditLabels } from './issue/read-issue-edit-labels.ts';
import { readIssueLabels } from './issue/read-issue-labels.ts';
import { getEditLabelRefusal } from './labels/get-edit-label-refusal.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { readGhArguments, type GhArguments } from './read-gh-arguments.ts';

const CHECKS = new Map<string, (args: GhArguments, command: string) => string | undefined>([
  ['issue create', getCreateRefusal],
  ['issue edit', getEditRefusal],
]);

// A reason to refuse a `gh issue create` or `gh issue edit` whose title, labels or
// body break the rules, or undefined.
export function getIssueRefusal(call: Call): string | undefined {
  const action = getGhAction(call.words);
  const check = CHECKS.get(action);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || check === undefined || spec === undefined) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  return 'refusal' in args ? args.refusal : check(args, spec.command);
}

function getCreateRefusal(args: GhArguments, command: string): string | undefined {
  const forbidden = getForbiddenOptionRefusal(args, command)
    ?? getIssueTitleRefusal(args, command, true);

  if (forbidden !== undefined) {
    return forbidden;
  }

  const labels = readIssueLabels(args, command);

  return 'refusal' in labels ? labels.refusal : getBodyRefusal(args, command, labels.rules);
}

function getEditRefusal(args: GhArguments, command: string): string | undefined {
  const refusal = getForbiddenOptionRefusal(args, command)
    ?? getIssueTitleRefusal(args, command, false)
    ?? getEditLabelRefusal(args, command);

  if (refusal !== undefined) {
    return refusal;
  }

  const labels = readIssueEditLabels(args, command);

  if ('refusal' in labels) {
    return labels.refusal;
  }

  if (!args.values.has('body-file')) {
    return undefined;
  }

  return labels.rules === undefined
    ? getEditBodyRefusal(args, command)
    : getBodyRefusal(args, command, labels.rules);
}

// Without a type label in the call the kind of an existing issue is not visible
// here, so the body may follow any kind's headings.
function getEditBodyRefusal(args: GhArguments, command: string): string | undefined {
  const kinds = [...ghCommands.bodies.issue.entries()];
  const refusals = kinds.map(([, rules]) => getBodyRefusal(args, command, rules));
  const [first] = refusals;

  if (refusals.includes(undefined)) {
    return undefined;
  }

  return refusals.every((refusal) => refusal === first)
    ? first
    : ghCommands.reasons.editBodyKinds(
      command,
      kinds.map(([kind, rules]) => `${ kind }: ${ rules.headings.join(', ') }`),
    );
}
