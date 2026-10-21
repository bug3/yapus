import { labelNames } from '../../../../../../shared/labels/read-labels.ts';
import { ghCommands, type BodyRules } from '../gh-commands.ts';
import { getUnknownLabelRefusal } from '../labels/get-unknown-label-refusal.ts';
import { readLabelNames } from '../labels/read-label-names.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';
import { readIssueKind } from './read-issue-kind.ts';
import { readIssueTitle } from './read-issue-title.ts';

export interface IssueLabels {
  // The body rules of the issue's kind.
  readonly rules: BodyRules;
}

// The kind of a new issue from its labels, which must be exactly one `type:` label
// and the `scope:` label of the title, besides hand-kept extras and never the
// breaking-change label. The title is read before this.
export function readIssueLabels(
  args: GhArguments,
  command: string,
): IssueLabels | GhRefusal {
  const named = readLabelNames(args, command, 'label');
  const titles = readLiteralValues(args, command, 'title');

  if ('refusal' in named) {
    return named;
  }

  const unknown = getUnknownLabelRefusal(named.names, command);

  if (unknown !== undefined) {
    return { refusal: unknown };
  }

  const scope = 'texts' in titles ? readIssueTitle(titles.texts.at(-1) ?? '')?.scope : undefined;
  const names = [...new Set(named.names)];
  const types = names.filter((name) => name.startsWith(labelNames.typePrefix));
  const scopes = names.filter((name) => name.startsWith(labelNames.scopePrefix));
  const rules = types.length === 1 ? readIssueKind(types[0] ?? '') : undefined;
  const isExact = scopes.length === 1
    && scopes[0] === `${ labelNames.scopePrefix }${ scope ?? '' }`
    && !names.includes(labelNames.breaking);

  return isExact && rules !== undefined
    ? { rules }
    : { refusal: ghCommands.reasons.issueLabels(command, scope ?? '<scope>') };
}
