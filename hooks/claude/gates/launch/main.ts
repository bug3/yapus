import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getVerdict, type Input, type Verdict } from './get-verdict.ts';

const PROGRAM = 'delegator launch';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);

    stop(input === undefined
      ? { kind: 'deny', detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry` }
      : getVerdict(input));
  } catch (error) {
    stop({ kind: 'deny', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  return {
    stdinText: await text(process.stdin),
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    time: new Date().toISOString(),
  };
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Agent call and shows Claude the reason on stderr.
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
