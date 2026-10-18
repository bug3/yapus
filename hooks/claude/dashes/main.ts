import { writeSync } from 'node:fs';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getMessagesWithinLimit } from './get-messages-within-limit.ts';
import { formatMessage } from './output/format-message.ts';
import { getExitCode } from './output/get-exit-code.ts';

const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    stop(await getMessagesWithinLimit(process.stdin, LIMIT_SECONDS));
  } catch (error) {
    stop([formatMessage(`crashed: ${ getFirstLine(error) }; the call is blocked, fix the hook`)]);
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(messages: readonly string[]): never {
  for (const message of messages) {
    writeSync(process.stderr.fd, `${ message }\n`);
  }

  process.exit(getExitCode(messages));
}

await main();
