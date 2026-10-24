import { getSubjectViolations } from '../../../../shared/subject/get-subject-violations.ts';
import type { Word } from '../shell/split-commands.ts';
import { getBodyRefusal } from './body/get-body-refusal.ts';
import { ghCommands, type BodyRules } from './gh-commands.ts';
import { getCreateLabelRefusal } from './labels/get-create-label-refusal.ts';
import { getForbiddenOptionRefusal } from './options/get-forbidden-option-refusal.ts';
import { isHelpRequest } from './options/is-help-request.ts';
import { readLiteralValues } from './options/read-literal-values.ts';
import type { GhCatalogs } from './read-gh-catalogs.ts';
import { readGhArguments, type GhArguments } from './read-gh-arguments.ts';

const { reasons } = ghCommands;
const spec = ghCommands.actions.prCreate;
// Without catalogs the footer, which names the catalog's owner, is not asked for.
const BODY_WITHOUT_CATALOGS: BodyRules = { headings: ghCommands.bodies.pr.headings, footer: [] };

// A reason to refuse a `gh pr create` whose options, title, labels or body file
// break the rules, or undefined. `words` follow the action; `cwd` is the
// directory a relative body file resolves against, undefined when unknown;
// `catalogs` judge the title and the labels, and without them only the
// options, the title's presence and the body headings are judged.
export function getPrRefusal(
  words: readonly Word[],
  cwd: string | undefined,
  catalogs: GhCatalogs | undefined,
): string | undefined {
  const args = readGhArguments(words, spec);

  if ('refusal' in args) {
    return args.refusal;
  }

  if (isHelpRequest(args)) {
    return undefined;
  }

  const rules = catalogs === undefined ? BODY_WITHOUT_CATALOGS : ghCommands.bodies.pr;

  return getForbiddenOptionRefusal(args, spec.command)
    ?? getTitleRefusal(args, catalogs)
    ?? (catalogs === undefined ? undefined : getCreateLabelRefusal(args, spec.command, catalogs))
    ?? getBodyRefusal(args, { command: spec.command, rules, cwd });
}

function getTitleRefusal(args: GhArguments, catalogs: GhCatalogs | undefined): string | undefined {
  const titles = readLiteralValues(args, spec.command, 'title');

  if ('refusal' in titles) {
    return titles.refusal;
  }

  const title = titles.texts.at(-1);

  if (title === undefined) {
    return reasons.missingOption(spec.command, '--title');
  }

  if (catalogs === undefined) {
    return undefined;
  }

  const violations = getSubjectViolations(title, catalogs, {
    allowAutosquash: false,
    allowGenerated: false,
  });

  return violations.length === 0 ? undefined : reasons.title(spec.command, violations);
}
