import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getOutcome, type Input, NOT_WRITTEN, type Outcome } from './get-outcome.ts';

const PROGRAM = 'delegator link';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);
    const late = `no input within ${ String(LIMIT_SECONDS) } seconds; ${ NOT_WRITTEN }`;

    stop(input === undefined ? { kind: 'failure', detail: late } : getOutcome(input));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  return {
    stdinText: await text(process.stdin),
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    projectRoot: process.env.CLAUDE_PROJECT_DIR,
    time: new Date().toISOString(),
  };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// Exit 2 after a tool call stops nothing; it shows the agent the reason on
// stderr. stdout stays empty, since it would reach the agent. writeSync,
// because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'written':
    case 'silence':
      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

await main();
