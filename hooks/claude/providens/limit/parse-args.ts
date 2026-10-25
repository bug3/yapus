export interface LimitChange {
  readonly limit: number;
  readonly isGlobal: boolean;
}

const WHOLE_NUMBER = /^\d+$/u;

// The arguments after the session id: exactly one whole number, and --global
// at most once, in either order. Anything else is not a change.
export function parseArgs(args: readonly string[]): LimitChange | undefined {
  const numbers = args.filter((arg) => WHOLE_NUMBER.test(arg));
  const globals = args.filter((arg) => arg === '--global');
  const [number] = numbers;
  const limit = Number(number);

  // A number past the safe range would be written as 1e+21, which no gate reads.
  if (number === undefined || numbers.length > 1 || globals.length > 1
    || numbers.length + globals.length < args.length || !Number.isSafeInteger(limit)) {
    return undefined;
  }

  return { limit, isGlobal: globals.length === 1 };
}
