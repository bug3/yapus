import type { Call } from '../../calls/get-calls.ts';
import type { Item } from '../../shell/split-commands.ts';
import { getGhAction } from './get-gh-action.ts';
import { ghCommands } from './gh-commands.ts';
import { readGhArguments } from './read-gh-arguments.ts';

// A reason to refuse a gh call that reads a body file when the line holds anything
// else that could write that file first, or undefined. The gate reads the file
// before the line runs, so the call must be the one command of its line.
export function getBodyLineRefusal(call: Call, items: readonly Item[]): string | undefined {
  const action = getGhAction(call.words);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || spec === undefined || isOnlyCommand(items)) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  return 'values' in args && args.values.has('body-file')
    ? ghCommands.reasons.bodyLine(action)
    : undefined;
}

// Whether the line is one command that is gh itself, written as `gh` or a path
// ending in `/gh`, with no redirection that could write the file first. A wrapper,
// a string a shell runs and the like are not.
function isOnlyCommand(items: readonly Item[]): boolean {
  const [item] = items;
  const program = item?.kind === 'command' ? item.words[0] : undefined;

  return items.length === 1 && item?.kind === 'command' && !item.hasRedirection
    && program !== undefined
    && (program.text === 'gh' || program.text.endsWith('/gh'));
}
