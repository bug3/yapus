// The pieces every shell module shares. It imports none of them, so the readers'
// import cycles never depend on which module loads first.

export interface SplitFailure {
  readonly kind: 'failure';
  readonly reason: string;
}

// `level` counts the substitutions that enclose the text being read;
// `isInDoubleQuotes` is true when that text is inside double quotes.
export interface Context {
  readonly home: string | undefined;
  readonly level: number;
  readonly isInDoubleQuotes?: boolean;
}

export function makeFailure(reason: string): SplitFailure {
  return { kind: 'failure', reason };
}
