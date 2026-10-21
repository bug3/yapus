import { ghCommands } from '../gh-commands.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { getUnknownLabelRefusal } from './get-unknown-label-refusal.ts';
import { isTitleLabel } from './is-title-label.ts';
import { readLabelNames } from './read-label-names.ts';

// A reason to refuse an edit that adds a label outside the catalog or removes a
// label the title says (the gate cannot see the title there), or undefined.
export function getEditLabelRefusal(args: GhArguments, command: string): string | undefined {
  const added = readLabelNames(args, command, 'add-label');
  const removed = readLabelNames(args, command, 'remove-label');

  if ('refusal' in added) {
    return added.refusal;
  }

  if ('refusal' in removed) {
    return removed.refusal;
  }

  const kept = removed.names.find(isTitleLabel);

  return getUnknownLabelRefusal(added.names, command)
    ?? (kept === undefined ? undefined : ghCommands.reasons.removedTitleLabel(command, kept));
}
