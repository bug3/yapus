import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';
import { type Applied, applyMode } from './apply-mode.ts';
import { parseArgs } from './parse-args.ts';

const PROGRAM = 'providens mode';
const USAGE = 'usage: providens mode <dataDir> <sessionId> on|off [--global]; give a data dir, '
  + 'an id of letters, digits and hyphens, one of on or off, and --global at most once';

function main(): void {
  try {
    stop(getOutcome(process.argv.slice(2)));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the program` });
  }
}

// The data dir and the session id come from the two arguments, never from the
// environment, so the mode is written where the gate reads.
function getOutcome(args: readonly string[]): Applied {
  const [dataDir, sessionId, ...rest] = args;
  const change = parseArgs(rest);

  if (dataDir === undefined || dataDir === '' || !isSafeId(sessionId) || change === undefined) {
    return { kind: 'failure', detail: USAGE };
  }

  return applyMode(dataDir, sessionId, change);
}

function stop(outcome: Applied): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Applied): 0 | 2 {
  switch (outcome.kind) {
    case 'text':
      writeSync(process.stdout.fd, outcome.text);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

main();
