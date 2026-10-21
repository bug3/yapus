import { labelNames } from '../../../../../../shared/labels/read-labels.ts';
import { ghCommands, type BodyRules } from '../gh-commands.ts';
import { getUnknownLabelRefusal } from '../labels/get-unknown-label-refusal.ts';
import { readLabelNames } from '../labels/read-label-names.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';
import { readIssueTitle } from './read-issue-title.ts';

export interface IssueLabels {
  // The body rules of the issue's kind.
  readonly rules: BodyRules;
}

// The kind of a new issue from its labels, which must be exactly one `kind:` label
// and the `scope:` label of the title. The title is read before this.
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
  const kinds = names.filter((name) => name.startsWith(labelNames.kindPrefix));
  const rules = ghCommands.bodies.issue.get(
    kinds[0]?.slice(labelNames.kindPrefix.length) ?? '',
  );
  const isExact = names.length === 2
    && names.includes(`${ labelNames.scopePrefix }${ scope ?? '' }`);

  return isExact && rules !== undefined
    ? { rules }
    : {
      refusal: ghCommands.reasons.issueLabels(
        command,
        [...ghCommands.bodies.issue.keys()].map((kind) => `${ labelNames.kindPrefix }${ kind }`),
        scope ?? '<scope>',
      ),
    };
}
