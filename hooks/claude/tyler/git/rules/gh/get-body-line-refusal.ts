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

  if (call.tool !== 'gh' || spec === undefined || isOnlyCommand(call, items)) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  return 'values' in args && args.values.has('body-file')
    ? ghCommands.reasons.bodyLine(action)
    : undefined;
}

// Whether the line is one command whose last words are the call's: a call read
// out of a string (`bash -c 'cat > f; gh ...'`) is not.
function isOnlyCommand(call: Call, items: readonly Item[]): boolean {
  const [item] = items;

  if (items.length !== 1 || item?.kind !== 'command') {
    return false;
  }

  const start = item.words.length - call.words.length;

  return call.words.every((word, index) => item.words[start + index]?.text === word.text);
}
