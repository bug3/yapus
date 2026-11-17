import { existsSync, lstatSync, mkdirSync, renameSync, rmdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { prepareMonthDirectory } from '../sessions/prepare-month-directory.ts';
import { formatMove } from './format-moves.ts';
import { getStateDirectory } from './get-state-directory.ts';
import type { Move, Rename } from './merge-found.ts';

// The mode prepareMonthDirectory gives the sessions directory: a prompt can
// hold a pasted secret.
const PRIVATE_DIRECTORY_MODE = 0o700;
const AFTER_FAILURE = 'no move after it is made; repair it and run the command again';
const DONE = { kind: 'done' } as const;

export type Applied =
  | { readonly kind: 'done' }
  | { readonly kind: 'failure'; readonly detail: string };

// Carries out the moves in order and stops at the first that fails, since a
// later move can rest on an earlier one; the next run takes what is left by
// the state it finds. Nothing is overwritten and nothing merged: a rename
// whose target exists by then is a failure, an empty directory too, and the
// older directory goes only when it is empty.
export function applyMoves(projectRoot: string, moves: readonly Move[]): Applied {
  for (const move of moves) {
    const applied = applyMove(projectRoot, move);

    if (applied.kind === 'failure') {
      const failed = `${ formatMove(move) } failed: ${ applied.detail }`;

      return { kind: 'failure', detail: `${ failed }; ${ AFTER_FAILURE }` };
    }
  }

  return DONE;
}

function applyMove(projectRoot: string, move: Move): Applied {
  try {
    return move.kind === 'removal' ? remove(projectRoot, move.path) : rename(projectRoot, move);
  } catch (error) {
    return { kind: 'failure', detail: getFirstLine(error) };
  }
}

function rename(projectRoot: string, move: Rename): Applied {
  const stateDirectory = getStateDirectory(projectRoot);
  const to = join(stateDirectory, move.to);

  // A rename replaces a file and an empty directory without a word.
  if (lstatSync(to, { throwIfNoEntry: false }) !== undefined) {
    return { kind: 'failure', detail: `${ move.to } exists` };
  }

  prepareDirectory(projectRoot, move.kind, dirname(to));
  renameSync(join(stateDirectory, move.from), to);

  return DONE;
}

// The directory a rename goes into: the sessions directory and its months
// private, as remember creates them, a plan's month and directory with the
// default mode. An existing directory keeps its mode.
function prepareDirectory(projectRoot: string, kind: Rename['kind'], directory: string): void {
  switch (kind) {
    case 'ignore':
      if (!existsSync(directory)) {
        mkdirSync(directory, { mode: PRIVATE_DIRECTORY_MODE });
      }

      break;
    case 'log':
      prepareMonthDirectory(projectRoot, basename(directory));

      break;
    case 'plan':
      mkdirSync(directory, { recursive: true });

      break;
  }
}

function remove(projectRoot: string, name: string): Applied {
  const path = join(getStateDirectory(projectRoot), name);

  if (lstatSync(path).isDirectory()) {
    rmdirSync(path);
  } else {
    unlinkSync(path);
  }

  return DONE;
}
