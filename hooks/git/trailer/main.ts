import { writeSync } from 'node:fs';
import { join } from 'node:path';
import { getExclusion } from '../../shared/exclusion/get-exclusion.ts';
import { formatMessage } from '../../shared/format-message.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { addTrailers, type TrailerInput } from './add-trailers.ts';

const PROGRAM = 'trailer';
const LIMIT_SECONDS = 5;

function main(): void {
  try {
    if (isExcluded()) {
      stop(undefined);
    }

    stop(addTrailers(readTrailerInput()));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; the commit is blocked, fix the hook`);
  }
}

// ordo adds no trailer in a project on the exclusion list under HOME; git runs
// the hook inside the repository, whose main root the list holds.
function isExcluded(): boolean {
  return getExclusion(process.cwd(), process.env.HOME ?? '', process.env).kind === 'excluded';
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
