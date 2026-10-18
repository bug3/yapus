import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { formatMessage } from './format-message.ts';
import { getPushViolation, type PushInput } from './get-push-violation.ts';
import { readStdin } from './read-stdin.ts';

const STDIN_LIMIT_SECONDS = 5;
const INTERRUPTS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const NO_STDIN = 'no push lines within 5 seconds; the push is blocked, retry it';

async function main(): Promise<void> {
  try {
    const pushInput = await readPushInput();

    stop(pushInput === undefined ? NO_STDIN : await getPushViolation(pushInput));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; the push is blocked, fix the hook`);
  }
}

// git runs the hook at the work tree root, so the working directory is the
// repository; tmpdir reads TMPDIR.
async function readPushInput(): Promise<PushInput | undefined> {
  const signal = makeInterruptSignal();
  const stdinText = await readStdin(process.stdin, STDIN_LIMIT_SECONDS);

  return stdinText === undefined
    ? undefined
    : { stdinText, env: process.env, repository: process.cwd(), tempParent: tmpdir(), signal };
}

// Node would end at once on each of these; the signal lets the push test stop
// npm test and remove its worktree first. npm test runs in a process group of
// its own, so a terminal hangup reaches only node. Every signal stays caught,
// so that a second one during the cleanup cannot end node either.
function makeInterruptSignal(): AbortSignal {
  const controller = new AbortController();
  const abort = (): void => {
    controller.abort();
  };

  for (const interrupt of INTERRUPTS) {
    process.on(interrupt, abort);
  }

  return controller.signal;
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(violation: string | undefined): never {
  if (violation !== undefined) {
    writeSync(process.stderr.fd, `${ formatMessage(violation) }\n`);
  }

  process.exit(violation === undefined ? 0 : 2);
}

await main();
