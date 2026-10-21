import type { Call } from '../../../calls/get-calls.ts';
import { readBodyFile } from '../body/read-body-file.ts';
import { getGhAction } from '../get-gh-action.ts';
import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import { readGhArguments, type GhArguments } from '../read-gh-arguments.ts';

const { comments, reasons } = ghCommands;

const COMMENT_ACTIONS: readonly string[] = comments.actions;

// A reason to refuse a `gh pr comment`, `gh issue comment` or `gh pr review` whose
// text the gate cannot read (an editor, a browser, an expanded `--body`, a body
// file that is not an absolute path to a readable file), or undefined.
export function getCommentRefusal(call: Call): string | undefined {
  const action = getGhAction(call.words);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || spec === undefined || !COMMENT_ACTIONS.includes(action)) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  return 'refusal' in args ? args.refusal : getTextRefusal(args, spec.command);
}

function getTextRefusal(args: GhArguments, command: string): string | undefined {
  const forbidden = comments.forbiddenOptions
    .find((option) => args.flags.get(option) === true);

  if (forbidden !== undefined) {
    return reasons.commentForbiddenOption(command, forbidden);
  }

  const bodies = readLiteralValues(args, command, 'body');

  if ('refusal' in bodies) {
    return bodies.refusal;
  }

  if (!args.values.has('body-file')) {
    return undefined;
  }

  const file = readBodyFile(args, command);

  return 'refusal' in file ? file.refusal : undefined;
}
