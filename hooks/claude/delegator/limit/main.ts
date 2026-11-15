import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getTarget } from '../settings/get-target.ts';
import { applyLimit } from './apply-limit.ts';
import { parseArgs } from './parse-args.ts';

const PROGRAM = 'delegator limit';
const USAGE = 'usage: delegator limit <dataDir> <sessionId> <whole number> [--global]; give a '
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

  const target = getTarget(dataDir, sessionId);

  if (target === undefined || change === undefined) {
    return { kind: 'failure', detail: USAGE };
  }

  return { kind: 'text', text: applyLimit(target.dataDir, target.sessionId, change).text };
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
