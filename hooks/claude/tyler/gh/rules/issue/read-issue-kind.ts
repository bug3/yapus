import { labelNames } from '../../../../../shared/labels/read-labels.ts';
import { ghCommands, type BodyRules } from '../gh-commands.ts';

// The body rules of the issue kind a `type:` label gives, or undefined when the
// label is not a type label.
export function readIssueKind(label: string): BodyRules | undefined {
  if (!label.startsWith(labelNames.typePrefix)) {
    return undefined;
  }

  const { byType, fallback } = ghCommands.issueKinds;
  const kind = byType.get(label.slice(labelNames.typePrefix.length)) ?? fallback;

  return ghCommands.bodies.issue[kind];
}
