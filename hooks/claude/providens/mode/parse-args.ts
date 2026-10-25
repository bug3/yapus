import type { Mode } from '../settings/read-mode.ts';

export interface ModeChange {
  readonly mode: Mode;
  readonly isGlobal: boolean;
}

// The arguments after the session id: exactly one of on or off, and --global
// at most once, in either order. Anything else is not a change.
export function parseArgs(args: readonly string[]): ModeChange | undefined {
  const modes = args.filter((arg) => arg === 'on' || arg === 'off');
  const globals = args.filter((arg) => arg === '--global');
  const [mode] = modes;

  if (mode === undefined || modes.length > 1 || globals.length > 1
    || modes.length + globals.length < args.length) {
    return undefined;
  }

  return { mode: mode === 'on' ? 'on' : 'off', isGlobal: globals.length === 1 };
}
