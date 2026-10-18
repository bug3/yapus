import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getReturnVerdict, type Input, type ReturnVerdict } from './get-return-verdict.ts';

const PROGRAM = 'providens return';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);

    stop(input === undefined
      ? { kind: 'shorten', detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry` }
      : getReturnVerdict(input));
  } catch (error) {
    stop({ kind: 'shorten', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  return {
    stdinText: await text(process.stdin),
    dataDir: process.env.CLAUDE_PLUGIN_DATA,
    time: new Date().toISOString(),
  };
}

function stop(verdict: ReturnVerdict): never {
  process.exit(write(verdict));
}

// Exit 2 keeps the subagent running and gives it the reason on stderr.
// writeSync, because process.exit can drop a pending write to a pipe.
function write(verdict: ReturnVerdict): 0 | 2 {
  switch (verdict.kind) {
    case 'pass':
      return 0;
    case 'shorten':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.detail) }\n`);

      return 2;
  }
}

await main();
