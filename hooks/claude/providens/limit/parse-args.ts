import { LIMIT } from '../settings/read-limit.ts';

export interface LimitChange {
  readonly limit: number;
  readonly isGlobal: boolean;
}

// The arguments after the session id: exactly one whole number, and --global
// at most once, in either order. Anything else is not a change.
export function parseArgs(args: readonly string[]): LimitChange | undefined {
  const numbers = args.filter((arg) => LIMIT.parse(arg) !== undefined);
  const globals = args.filter((arg) => arg === '--global');
  const [number] = numbers;
  const limit = number === undefined ? undefined : LIMIT.parse(number);

  // A number past the safe range is refused: it would be written as 1e+21,
  // which no gate reads, or rounded (9007199254740993 to ...992) before it is written.
  if (limit === undefined || numbers.length > 1 || globals.length > 1
    || numbers.length + globals.length < args.length || !Number.isSafeInteger(limit)) {
    return undefined;
  }

  return { limit, isGlobal: globals.length === 1 };
}
