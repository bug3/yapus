import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getPushViolation, type PushInput } from './get-push-violation.ts';
import { readStdin } from './read-stdin.ts';

const STDIN_LIMIT_MS = 5000;
const NO_STDIN = 'no push lines within 5 seconds; the push is blocked, retry it';

async function main(): Promise<void> {
  try {
    const pushInput = await readPushInput();

    stop(pushInput === undefined ? NO_STDIN : getPushViolation(pushInput));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; the push is blocked, fix the hook`);
  }
}

// git runs the hook at the work tree root, so the working directory is the
// repository; tmpdir reads TMPDIR.
async function readPushInput(): Promise<PushInput | undefined> {
  const stdinText = await readStdin(process.stdin, STDIN_LIMIT_MS);

  return stdinText === undefined
    ? undefined
    : { stdinText, env: process.env, repository: process.cwd(), tempParent: tmpdir() };
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(violation: string | undefined): never {
  if (violation !== undefined) {
    writeSync(process.stderr.fd, `yapus push: ${ violation }\n`);
  }

  process.exit(violation === undefined ? 0 : 2);
}

await main();
