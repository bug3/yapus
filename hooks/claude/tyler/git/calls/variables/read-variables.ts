import type { Call } from '../get-calls.ts';
import type { Cursor, Unreadable } from '../read-wrapper.ts';
import { CONFIG_REFUSAL, isConfigName, refuseSetting } from './refuse-setting.ts';

// The refusal for the variables a command's assignments and wrappers set or remove, or
// undefined; `call` is the call the command makes, if any.
export function readVariables(cursor: Cursor, call: Call | undefined): Unreadable | undefined {
  if (cursor.unsets.some(isConfigName)) {
    return CONFIG_REFUSAL;
  }

  return cursor.settings
    .map((word) => refuseSetting(word, call))
    .find((refusal) => refusal !== undefined);
}
