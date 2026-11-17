import type { Left, Move } from './merge-found.ts';

const NOTHING = 'nothing to move';

// The list a run prints before it moves: one line per move in the order the
// moves are made, or one line that says there is none.
export function formatMoves(moves: readonly Move[]): string {
  const lines = moves.length === 0 ? [NOTHING] : moves.map((move) => formatMove(move));

  return lines.map((line) => `${ line }\n`).join('');
}

export function formatMove(move: Move): string {
  return move.kind === 'removal' ? `${ move.path } removed` : `${ move.from } -> ${ move.to }`;
}

export function formatLeft({ path, reason }: Left): string {
  return `${ path } is left: ${ reason }`;
}
