import { readSubjectParts } from '../../../../../shared/subject/read-subject-parts.ts';
import { labelNames } from '../../../../../shared/labels/read-labels.ts';
import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { getUnknownLabelRefusal } from './get-unknown-label-refusal.ts';
import { isTitleLabel } from './is-title-label.ts';
import { readLabelNames } from './read-label-names.ts';

// A reason to refuse the labels of a pull request create that are not catalog
// labels, or that do not state exactly what its title says, or undefined.
export function getCreateLabelRefusal(args: GhArguments, command: string): string | undefined {
  const named = readLabelNames(args, command, 'label');
  const titles = readLiteralValues(args, command, 'title');
  const parts = 'texts' in titles ? readSubjectParts(titles.texts.at(-1) ?? '') : undefined;

  if ('refusal' in named) {
    return named.refusal;
  }

  const unknown = getUnknownLabelRefusal(named.names, command);

  if (unknown !== undefined || parts === undefined) {
    return unknown;
  }

  const expected = [
    `${ labelNames.typePrefix }${ parts.type }`,
    `${ labelNames.scopePrefix }${ parts.scope }`,
    ...(parts.isBreaking ? [labelNames.breaking] : []),
  ];
  const written = [...new Set(named.names.filter(isTitleLabel))];
  const isExact = written.length === expected.length
    && expected.every((label) => written.includes(label));

  return isExact ? undefined : ghCommands.reasons.titleLabels(command, expected);
}
