import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { type Call, getHandover } from '../../delegator/memory/handover/get-handover.ts';
import { getVerdict, type Input, type Verdict } from './get-verdict.ts';
import { parseLaunch } from './parse-launch.ts';

const PROGRAM = 'delegator launch';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);

    if (input === undefined) {
      stop({ kind: 'deny', detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry` });
    }

    const verdict = getVerdict(input);

    if (verdict.kind === 'allow') {
      handOver(input);
    }

    stop(verdict);
  } catch (error) {
    stop({ kind: 'deny', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input & Call> {
  return {
    stdinText: await text(process.stdin),
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    projectDir: process.env.CLAUDE_PROJECT_DIR,
    time: new Date().toISOString(),
  };
}

// Writes the rules of the project's memory that name the agent type of an
// allowed launch. An error in the reading or in the write leaves the verdict
// as it is, so the hand-over adds no way to block a launch.
function handOver(input: Input & Call): void {
  try {
    const parsed = parseLaunch(input.stdinText);
    const handover = parsed.kind === 'failure'
      ? undefined
      : getHandover(input, (event) => (
        event.kind === 'launch' && event.agentType === parsed.launch.subagentType
      ));

    if (handover !== undefined) {
      writeSync(process.stdout.fd, `${ handover }\n`);
    }
  } catch {
    // Nothing is handed.
  }
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Agent call and shows the agent the reason on stderr.
// writeSync, because process.exit can drop a pending write to a pipe.
function write(verdict: Verdict): 0 | 2 {
  switch (verdict.kind) {
    case 'allow':
      return 0;
    case 'deny':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.detail) }\n`);

      return 2;
  }
}

await main();
