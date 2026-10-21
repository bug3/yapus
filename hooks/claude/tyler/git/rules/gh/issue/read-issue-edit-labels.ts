import { labelNames } from '../../../../../../shared/labels/read-labels.ts';
import { ghCommands, type BodyRules } from '../gh-commands.ts';
import { readLabelNames } from '../labels/read-label-names.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';
import { readIssueKind } from './read-issue-kind.ts';
import { readIssueTitle } from './read-issue-title.ts';

export interface IssueEditLabels {
  // The body rules of the kind the added type label gives, when it adds one.
  readonly rules: BodyRules | undefined;
}

// The kind an issue edit sets with the labels it adds, which hold at most one type
// label, at most one scope label equal to the scope of the title in the same call,
// and no breaking-change label.
export function readIssueEditLabels(
  args: GhArguments,
  command: string,
): IssueEditLabels | GhRefusal {
  const added = readLabelNames(args, command, 'add-label');
  const titles = readLiteralValues(args, command, 'title');

  if ('refusal' in added) {
    return added;
  }

  const scope = 'texts' in titles ? readIssueTitle(titles.texts.at(-1) ?? '')?.scope : undefined;
  const names = [...new Set(added.names)];
  const types = names.filter((name) => name.startsWith(labelNames.typePrefix));
  const scopes = names.filter((name) => name.startsWith(labelNames.scopePrefix));
  const isScopeWrong = scopes[0] !== undefined && scope !== undefined
    && scopes[0] !== `${ labelNames.scopePrefix }${ scope }`;

  return types.length > 1 || scopes.length > 1 || isScopeWrong
    || names.includes(labelNames.breaking)
    ? { refusal: ghCommands.reasons.issueEditLabels(command) }
    : { rules: readIssueKind(types[0] ?? '') };
}
