import { writeSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { applyMoves } from './apply-moves.ts';
import { findMoves } from './find-moves.ts';
import { formatLeft, formatMoves } from './format-moves.ts';

const PROGRAM = 'delegator upgrade';
const USAGE = 'usage: delegator upgrade <project dir>; give the absolute path of the project '
  + 'and nothing else';

function main(): void {
  try {
    const projectRoot = getProjectRoot(process.argv.slice(2));

    stop(projectRoot === undefined ? [USAGE] : upgrade(projectRoot));
  } catch (error) {
    stop([`crashed: ${ getFirstLine(error) }; fix the program`]);
  }
}

// The project comes from the one argument, never from the environment or the
// working directory, so the command names what moves.
function getProjectRoot(args: readonly string[]): string | undefined {
  const [projectRoot, ...extra] = args;

  return projectRoot !== undefined && isAbsolute(projectRoot) && extra.length === 0
    ? projectRoot
    : undefined;
}

// Moves the project's .yapus/ files into the present layout and gives the
// failures, one for each file left and one for a move that failed. Every move
// is printed before the first is made: the list read backwards undoes the
// run. writeSync, because process.exit can drop a pending write to a pipe.
function upgrade(projectRoot: string): string[] {
  const { moves, left } = findMoves(projectRoot);

  writeSync(process.stdout.fd, formatMoves(moves));

  const applied = applyMoves(projectRoot, moves);

  return [
    ...left.map((file) => formatLeft(file)),
    ...(applied.kind === 'failure' ? [applied.detail] : []),
  ];
}

function stop(failures: readonly string[]): never {
  for (const failure of failures) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, failure) }\n`);
  }

  process.exit(failures.length === 0 ? 0 : 2);
}

main();
