import { getSubjectViolations } from '../../../../../shared/subject/get-subject-violations.ts';
import type { Call } from '../../calls/get-calls.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import { getGhAction } from './get-gh-action.ts';
import { ghCatalogs } from './gh-catalogs.ts';
import { ghCommands } from './gh-commands.ts';
import { getCreateLabelRefusal } from './labels/get-create-label-refusal.ts';
import { getEditLabelRefusal } from './labels/get-edit-label-refusal.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { readLiteralValues } from './options/read-literal-values.ts';
import { readGhArguments, type GhArguments } from './read-gh-arguments.ts';

const { reasons } = ghCommands;

const CHECKS = new Map<string, (args: GhArguments, command: string) => string | undefined>([
  ['pr create', getCreateRefusal],
  ['pr edit', getEditRefusal],
]);

// A reason to refuse a `gh pr create` or `gh pr edit` whose title, draft state or
// body breaks the rules, or undefined.
export function getPrRefusal(call: Call): string | undefined {
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
  return getForbiddenOptionRefusal(args, command)
    ?? getTitleRefusal(args, command, true)
    ?? getDraftRefusal(args, command)
    ?? getCreateLabelRefusal(args, command)
    ?? getBodyRefusal(args, command, ghCommands.bodies.pr);
}

function getEditRefusal(args: GhArguments, command: string): string | undefined {
  return getForbiddenOptionRefusal(args, command)
    ?? getTitleRefusal(args, command, false)
    ?? getEditLabelRefusal(args, command)
    ?? (args.values.has('body-file')
      ? getBodyRefusal(args, command, ghCommands.bodies.pr)
      : undefined);
}

function getDraftRefusal(args: GhArguments, command: string): string | undefined {
  return args.flags.get('draft') === true ? undefined : reasons.draftOnly(command);
}

function getTitleRefusal(
  args: GhArguments,
  command: string,
  isRequired: boolean,
): string | undefined {
  const titles = readLiteralValues(args, command, 'title');

  if ('refusal' in titles) {
    return titles.refusal;
  }

  const title = titles.texts.at(-1);

  if (title === undefined) {
    return isRequired ? reasons.missingOption(command, '--title') : undefined;
  }

  if ('violation' in ghCatalogs) {
    return ghCatalogs.violation;
  }

  const violations = getSubjectViolations(title, ghCatalogs, { allowAutosquash: false });

  return violations.length === 0 ? undefined : reasons.title(command, violations);
}
