import type { Call } from '../../calls/get-calls.ts';
import { ghCommands } from './gh-commands.ts';

// A reason to refuse a gh command that has an action when an option or an unread
// word stands where the action should (`gh pr -R o/r create`), or undefined.
export function getMisplacedOptionRefusal(call: Call): string | undefined {
  const [command, action] = call.words;

  if (call.tool !== 'gh' || command === undefined || action === undefined) {
    return undefined;
  }

  const actionCommands: readonly string[] = ghCommands.actionCommands;
  const isMisplaced = actionCommands.includes(command.text)
    && (action.isOpaque || action.text.startsWith('-'));

  return isMisplaced ? ghCommands.reasons.optionBeforeAction(command.text) : undefined;
}
