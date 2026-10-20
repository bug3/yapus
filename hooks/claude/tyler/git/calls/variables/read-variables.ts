import type { Cursor, Unreadable } from '../read-wrapper.ts';
import { CONFIG_REFUSAL, isConfigName, refuseSetting } from './refuse-setting.ts';

// The refusal for the variables a command's assignments and wrappers set or remove, or
// undefined; `isCall` holds when the command is a git or gh call.
export function readVariables(cursor: Cursor, isCall: boolean): Unreadable | undefined {
  if (cursor.unsets.some(isConfigName)) {
    return CONFIG_REFUSAL;
  }

  return cursor.settings
    .map((word) => refuseSetting(word, isCall))
    .find((refusal) => refusal !== undefined);
}
