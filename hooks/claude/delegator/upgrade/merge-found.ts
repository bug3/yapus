// A rename toward the present layout, named for what its target needs first:
// the ignore file and a log go into the private sessions directory, a plan's
// directory or file into a month of the plans.
export interface Rename {
  readonly kind: 'ignore' | 'log' | 'plan';
  readonly from: string;
  readonly to: string;
}

// The removal of what the older layout leaves behind: its ignore file, then
// its emptied directory.
export interface Removal {
  readonly kind: 'removal';
  readonly path: string;
}

// One change of the upgrade, its paths relative to .yapus/ as they are
// printed.
export type Move = Rename | Removal;

// A file the upgrade leaves where it is, and why.
export interface Left {
  readonly path: string;
  readonly reason: string;
}

// What a step found of its own older shape: the moves in the order they are
// carried out, and the files it leaves.
export interface Found {
  readonly moves: readonly Move[];
  readonly left: readonly Left[];
}

// The parts as one, in their order.
export function mergeFound(parts: readonly Found[]): Found {
  return {
    moves: parts.flatMap(({ moves }) => moves),
    left: parts.flatMap(({ left }) => left),
  };
}
