import { getSubjectViolations } from '../../../../shared/subject/get-subject-violations.ts';
import type { Word } from '../shell/split-commands.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import { ghCatalogs } from './gh-catalogs.ts';
import { ghCommands } from './gh-commands.ts';
import { getCreateLabelRefusal } from './labels/get-create-label-refusal.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { isHelpRequest } from './options/is-help-request.ts';
import { readLiteralValues } from './options/read-literal-values.ts';
import { readGhArguments, type GhArguments } from './read-gh-arguments.ts';

const { reasons } = ghCommands;
const spec = ghCommands.actions.prCreate;

// A reason to refuse a `gh pr create` whose options, title, labels or body file
// break the rules, or undefined. `words` follow the action; `cwd` is the
// directory a relative body file resolves against, undefined when unknown.
export function getPrRefusal(words: readonly Word[], cwd: string | undefined): string | undefined {
  const args = readGhArguments(words, spec);

  if ('refusal' in args) {
    return args.refusal;
  }

  if (isHelpRequest(args)) {
    return undefined;
  }

  return getForbiddenOptionRefusal(args, spec.command)
    ?? getTitleRefusal(args)
    ?? getCreateLabelRefusal(args, spec.command)
    ?? getBodyRefusal(args, { command: spec.command, rules: ghCommands.bodies.pr, cwd });
}

function getTitleRefusal(args: GhArguments): string | undefined {
  const titles = readLiteralValues(args, spec.command, 'title');

  if ('refusal' in titles) {
    return titles.refusal;
  }

  const title = titles.texts.at(-1);

  if (title === undefined) {
    return reasons.missingOption(spec.command, '--title');
  }

  if ('violation' in ghCatalogs) {
    return ghCatalogs.violation;
  }

  const violations = getSubjectViolations(title, ghCatalogs, { allowAutosquash: false });

  return violations.length === 0 ? undefined : reasons.title(spec.command, violations);
}
