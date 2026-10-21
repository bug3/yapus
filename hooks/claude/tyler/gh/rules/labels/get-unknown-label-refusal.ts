import { ghCommands } from '../gh-commands.ts';
import { ghLabels } from './gh-labels.ts';

// A reason to refuse a label that is not in the label catalog, or the reason the
// catalog cannot be read, or undefined.
export function getUnknownLabelRefusal(
  names: readonly string[],
  command: string,
): string | undefined {
  if ('violation' in ghLabels) {
    return ghLabels.violation;
  }

  const labels = ghLabels;
  const unknown = names.find((name) => !labels.some((label) => label.name === name));

  return unknown === undefined ? undefined : ghCommands.reasons.unknownLabel(command, unknown);
}
