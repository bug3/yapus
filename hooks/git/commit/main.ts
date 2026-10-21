import { writeSync } from 'node:fs';
import { formatMessage } from '../../shared/format-message.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { scanStagedChange } from './scan-staged-change.ts';

const PROGRAM = 'commit';

async function main(): Promise<void> {
  try {
    // git runs the hook at the work tree root, so the working directory is
    // the repository.
    const verdict = await scanStagedChange(process.cwd(), process.env);

    stop(verdict.warnings, verdict.violations);
  } catch (error) {
    stop([], [`crashed: ${ getFirstLine(error) }; the commit is blocked, fix the hook`]);
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(warnings: readonly string[], violations: readonly string[]): never {
  for (const line of [...warnings, ...violations]) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, line) }\n`);
  }

  process.exit(violations.length === 0 ? 0 : 2);
}

await main();
