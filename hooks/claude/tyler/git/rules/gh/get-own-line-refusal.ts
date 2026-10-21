import type { Call } from '../../calls/get-calls.ts';
import type { Item } from '../../shell/split-commands.ts';
import { getGhAction } from './get-gh-action.ts';
import { ghCommands } from './gh-commands.ts';
import { readGhArguments, type GhArguments, type GhRefusal } from './read-gh-arguments.ts';

// A reason to refuse a gh call that must be the one command of its line, or
// undefined. A call that reads a body file is read before the line runs, so
// nothing else on the line may write that file first; the calls the catalog lists
// are judged against the directory and repository the line starts in, so nothing
// on the line may change them first.
export function getOwnLineRefusal(call: Call, items: readonly Item[]): string | undefined {
  const action = getGhAction(call.words);
  const spec = ghCommands.actions.get(action);

  if (call.tool !== 'gh' || spec === undefined || isOnlyCommand(items)) {
    return undefined;
  }

  const args = readGhArguments(call.words.slice(2), spec);

  if ('values' in args && args.values.has('body-file')) {
    return ghCommands.reasons.bodyLine(action);
  }

  return isOwnLineAction(action, args) ? ghCommands.reasons.ownLine(action) : undefined;
}

// An action with arguments the gate cannot read is not known to have the flag on.
function isOwnLineAction(action: string, args: GhArguments | GhRefusal): boolean {
  const flag = ghCommands.ownLine.unlessFlag.get(action);

  return ghCommands.ownLine.actions.some((own) => own === action)
    || flag !== undefined && !('flags' in args && args.flags.get(flag) === true);
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
