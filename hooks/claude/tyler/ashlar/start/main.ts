import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../../shared/get-within-limit.ts';
import { parseHookInput } from '../parse-hook-input.ts';
import { recordStart } from '../state/record-start.ts';

const PROGRAM = 'providens review';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(getFailure(stdinText, process.env.CLAUDE_PLUGIN_DATA));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; fix the hook`);
  }
}

// The detail of what failed, or undefined after the start is noted.
function getFailure(
  stdinText: string | undefined,
  dataDir: string | undefined,
): string | undefined {
  if (stdinText === undefined) {
    return `no input within ${ String(LIMIT_SECONDS) } seconds; retry`;
  }

  const parsed = parseHookInput(stdinText);

  if (parsed.kind === 'failure') {
    return `${ parsed.reason }; fix the hook input`;
  }

  if (dataDir === undefined || dataDir === '') {
    return 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin';
  }

  recordStart(dataDir, parsed.input.sessionId, new Date());

  return undefined;
}

function stop(failure: string | undefined): never {
  process.exit(write(failure));
}

// writeSync, because process.exit can drop a pending write to a pipe. Exit
// 2 at SessionStart cannot stop the session; it shows the person the error.
function write(failure: string | undefined): 0 | 2 {
  if (failure === undefined) {
    return 0;
  }

  writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, failure) }\n`);

  return 2;
}

await main();
