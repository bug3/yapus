import { writeSync } from 'node:fs';
import { getExclusion } from '../../shared/exclusion/get-exclusion.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getMessagesWithinLimit } from './get-messages-within-limit.ts';
import { formatMessage } from './output/format-message.ts';
import { getExitCode } from './output/get-exit-code.ts';

const LIMIT_SECONDS = 5;

// In a project on the ordo exclusion list the check is off, whatever the call.
async function main(): Promise<void> {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR ?? '';
    const home = process.env.HOME ?? '';
    const { env } = process;
    const isExcluded = () => getExclusion(projectDir, home, env).kind === 'excluded';

    stop(await getMessagesWithinLimit(process.stdin, LIMIT_SECONDS, isExcluded));
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
