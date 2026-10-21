import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { getFirstLine } from '../../shared/get-first-line.ts';

export interface TrailerInput {
  readonly messagePath: string;
  readonly catalogPath: string;
  readonly env: NodeJS.ProcessEnv;
  readonly limitSeconds: number;
}

const FIX_HOOK = 'the commit is blocked, fix the hook';

// Adds every trailer of the catalog, in its order, to the end of the message
// file, and gives back the reason when it cannot. addIfDifferent leaves a
// trailer an amended message already holds; --no-divider keeps a body line
// "---" from ending the message. git skips the comment lines an editor left,
// the scissors line and the diff below it included.
export function addTrailers(trailerInput: TrailerInput): string | undefined {
  const trailers = readTrailers(trailerInput.catalogPath);

  if (trailers === undefined) {
    return `${ trailerInput.catalogPath } is not a JSON array of trailer lines; ${ FIX_HOOK }`;
  }

  const args = [
    'interpret-trailers', '--in-place', '--if-exists', 'addIfDifferent', '--no-divider',
    ...trailers.flatMap((trailer) => ['--trailer', trailer]),
    trailerInput.messagePath,
  ];
  const run = spawnSync('git', args, {
    env: trailerInput.env,
    encoding: 'utf8',
    timeout: trailerInput.limitSeconds * 1000,
  });

  return run.status === 0
    ? undefined
    : `git interpret-trailers failed: ${ getRunDetail(run) }; ${ FIX_HOOK }`;
}

function readTrailers(catalogPath: string): readonly string[] | undefined {
  let trailers: unknown;

  try {
    trailers = JSON.parse(readFileSync(catalogPath, 'utf8'));
  } catch {
    return undefined;
  }

  return isTrailerList(trailers) ? trailers : undefined;
}

function isTrailerList(trailers: unknown): trailers is string[] {
  return Array.isArray(trailers) && trailers.every((trailer) => typeof trailer === 'string');
}

// A spawn error or the time limit, a kill by signal, or an exit with the
// first line git wrote to stderr.
function getRunDetail(run: SpawnSyncReturns<string>): string {
  if (run.error !== undefined) {
    return run.error.message;
  }

  return run.status === null
    ? `killed by ${ String(run.signal) }`
    : `exit ${ String(run.status) }: ${ getFirstLine(run.stderr) }`;
}
