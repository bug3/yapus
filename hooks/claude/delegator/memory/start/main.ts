import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../../shared/get-within-limit.ts';
import { isSessionOff } from '../../policy/is-session-off.ts';
import { type Context, getContext, type Input, NOT_GIVEN } from './get-context.ts';

const PROGRAM = 'delegator memory start';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);
    const late = `no input within ${ String(LIMIT_SECONDS) } seconds; ${ NOT_GIVEN }`;

    stop(input === undefined ? { kind: 'failure', detail: late } : getContext(input));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  const stdinText = await text(process.stdin);

  return {
    stdinText,
    isOff: isSessionOff(stdinText, process.env.CLAUDE_PLUGIN_DATA),
    projectRoot: process.env.CLAUDE_PROJECT_DIR,
    now: new Date(),
  };
}

function stop(context: Context): never {
  process.exit(write(context));
}

// writeSync, because process.exit can drop a pending write to a pipe. Exit
// 2 at SessionStart cannot stop the session; it shows the person the error.
function write(context: Context): 0 | 2 {
  switch (context.kind) {
    case 'silence':
      return 0;
    case 'output':
      writeSync(process.stdout.fd, `${ context.json }\n`);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, context.detail) }\n`);

      return 2;
  }
}

await main();
