import { writeSync } from 'node:fs';
import { join } from 'node:path';
import { formatMessage } from '../../shared/format-message.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { addTrailers, type TrailerInput } from './add-trailers.ts';

const PROGRAM = 'trailer';
const LIMIT_SECONDS = 5;

function main(): void {
  try {
    stop(addTrailers(readTrailerInput()));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; the commit is blocked, fix the hook`);
  }
}

// git runs commit-msg with the path of the message file.
function readTrailerInput(): TrailerInput {
  return {
    messagePath: process.argv[2] ?? '',
    catalogPath: join(import.meta.dirname, 'trailers.json'),
    env: process.env,
    limitSeconds: LIMIT_SECONDS,
  };
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(failure: string | undefined): never {
  if (failure !== undefined) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, failure) }\n`);
  }

  process.exit(failure === undefined ? 0 : 2);
}

main();
