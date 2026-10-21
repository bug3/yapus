import type { Word } from '../../shell/split-commands.ts';
import type { Call } from '../get-calls.ts';
import type { Cursor, Unreadable } from '../read-wrapper.ts';
import {
  AGENT_REFUSAL,
  CONFIG_REFUSAL,
  isAgentName,
  isConfigName,
  isConfigWord,
  refuseWatchedWord,
} from './refuse-watched-word.ts';

// The refusal for the watched variables a command may set or remove, or undefined;
// `call` is the call the command makes, if any, and `words` are the command's words. A
// GIT_CONFIG* assignment on a git call is left to the rules, which read its assignments.
export function readVariables(
  cursor: Cursor,
  call: Call | undefined,
  words: readonly Word[],
): Unreadable | undefined {
  if (cursor.unsets.some(isConfigName)) {
    return CONFIG_REFUSAL;
  }

  if (cursor.unsets.some(isAgentName)) {
    return AGENT_REFUSAL;
  }

  const isConfigSet = [...words, ...cursor.words].some((word) =>
    isConfigWord(word) && !(call?.tool === 'git' && cursor.settings.includes(word)));

  if (isConfigSet) {
    return CONFIG_REFUSAL;
  }

  return [...words, ...cursor.words]
    .map(refuseWatchedWord)
    .find((refusal) => refusal !== undefined);
}
