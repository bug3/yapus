import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getOutcome, type Input, type Outcome } from './get-outcome.ts';

const PROGRAM = 'providens resume';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);

    stop(input === undefined
      ? { kind: 'failure', detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry` }
      : getOutcome(input));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  return {
    stdinText: await text(process.stdin),
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    time: new Date().toISOString(),
  };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// Exit 2 after a tool call stops nothing; it shows Claude the reason on
// stderr. writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'recorded':
    case 'skipped':
      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

await main();
