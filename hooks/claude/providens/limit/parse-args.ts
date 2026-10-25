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

  if (number === undefined || numbers.length > 1 || globals.length > 1
    || numbers.length + globals.length < args.length) {
    return undefined;
  }

  return { limit: Number(number), isGlobal: globals.length === 1 };
}
