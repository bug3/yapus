import type { GhCatalogs } from '../read-gh-catalogs.ts';
import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { readIssueTitle } from './read-issue-title.ts';

const { reasons } = ghCommands;

// A reason to refuse an issue title that is not `<scope>: <symptom>` with a
// catalog scope, or a missing one, or undefined.
export function getIssueTitleRefusal(
  args: GhArguments,
  command: string,
  catalogs: GhCatalogs,
): string | undefined {
  const titles = readLiteralValues(args, command, 'title');

  if ('refusal' in titles) {
    return titles.refusal;
  }

  const title = titles.texts.at(-1);

  if (title === undefined) {
    return reasons.missingOption(command, '--title');
  }

  const parsed = readIssueTitle(title);

  return parsed !== undefined && catalogs.scopes.words.includes(parsed.scope)
    ? undefined
    : reasons.issueTitle(command, title);
}
