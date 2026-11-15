import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getOutcome, type Input, type Outcome } from './get-outcome.ts';

const PROGRAM = 'delegator recall';
const LIMIT_SECONDS = 5;
const NOT_RECALLED = 'the prompts are not recalled';

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);
    const late = `no input within ${ String(LIMIT_SECONDS) } seconds; ${ NOT_RECALLED }`;

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
  };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe. Exit
// 2 at SessionStart cannot stop the session; it shows the person the error.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'silence':
      return 0;
    case 'output':
      writeSync(process.stdout.fd, `${ outcome.json }\n`);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

await main();
