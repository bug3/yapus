import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { getMessages } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';
import { getExitCode } from './output/get-exit-code.ts';
import { getFirstLine } from './output/get-first-line.ts';

const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  setTimeout(() => {
    stop([
      formatMessage(
        `no answer within ${ String(LIMIT_SECONDS) } seconds; the call is blocked, retry it`,
      ),
    ]);
  }, LIMIT_SECONDS * 1000);

  try {
    const stdinText = await text(process.stdin);

    stop(await getMessages(stdinText));
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
