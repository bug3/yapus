import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getLine } from './get-line.ts';

const PROGRAM = 'ordo scopes';

// A line to report is on stdout and exit 0; a crash is a line on stderr and
// exit 2, which at SessionStart shows the person the error and blocks nothing.
async function main(): Promise<void> {
  try {
    const projectDir = process.env.CLAUDE_PROJECT_DIR ?? '';
    const home = process.env.HOME ?? '';

    stop(await getLine(projectDir, home, process.env));
  } catch (error) {
    fail(`crashed: ${ getFirstLine(error) }; fix the hook`);
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(line: string | undefined): never {
  if (line !== undefined) {
    const output = {
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: line },
    };

    writeSync(process.stdout.fd, `${ JSON.stringify(output) }\n`);
  }

  process.exit(0);
}

function fail(detail: string): never {
  writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, detail) }\n`);
  process.exit(2);
}

await main();
