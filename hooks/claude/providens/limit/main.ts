import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';
import { applyLimit } from './apply-limit.ts';
import { parseArgs } from './parse-args.ts';

const PROGRAM = 'providens limit';
const USAGE = 'usage: providens limit <dataDir> <sessionId> <whole number> [--global]; give a '
  + 'data dir, an id of letters, digits and hyphens, one whole number, and --global at most once';

type Outcome =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

function main(): void {
  try {
    stop(getOutcome(process.argv.slice(2)));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the program` });
  }
}

// The data dir and the session id come from the two arguments, never from the
// environment, so the limit is written where the gate reads.
function getOutcome(args: readonly string[]): Outcome {
  const [dataDir, sessionId, ...rest] = args;
  const change = parseArgs(rest);

  if (dataDir === undefined || dataDir === '' || !isSafeId(sessionId) || change === undefined) {
    return { kind: 'failure', detail: USAGE };
  }

  return { kind: 'text', text: applyLimit(dataDir, sessionId, change).text };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
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
