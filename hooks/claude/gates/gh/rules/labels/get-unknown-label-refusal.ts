import type { Label } from '../../../../../shared/labels/read-labels.ts';
import { ghCommands } from '../gh-commands.ts';

// A reason to refuse a label that is not among the repository's labels, or
// undefined.
export function getUnknownLabelRefusal(
  names: readonly string[],
  labels: readonly Label[],
  command: string,
): string | undefined {
  const unknown = names.find((name) => !labels.some((label) => label.name === name));

  return unknown === undefined ? undefined : ghCommands.reasons.unknownLabel(command, unknown);
}
