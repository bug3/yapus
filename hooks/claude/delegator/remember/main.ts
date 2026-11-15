import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getOutcome, type Input, type Outcome } from './get-outcome.ts';

const PROGRAM = 'delegator remember';
const LIMIT_SECONDS = 5;
const NOT_WRITTEN = 'the prompt is not remembered';

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

// Always exit 0, an exemption from CODE-4 for this program alone: exit 2 at
// UserPromptSubmit blocks the prompt, and a log that cannot write must not
// lock the person out. stdout stays empty, since it would reach the model.
// writeSync, because process.exit can drop a pending write to a pipe.
// A write to stderr that throws is dropped, so the exit always runs.
function stop(outcome: Outcome): never {
  if (outcome.kind === 'failure') {
    try {
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);
    } catch {
      // Nowhere left to say it; the prompt goes through.
    }
  }

  process.exit(0);
}

await main();
