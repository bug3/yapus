import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isSafeId } from '../../../shared/is-safe-id.ts';
import { getStatus } from './get-status.ts';

const PROGRAM = 'providens status';
const USAGE = 'usage: providens status <dataDir> <sessionId>; give a data dir, an id of letters, '
  + 'digits and hyphens, and nothing else';

type Outcome =
  | { readonly kind: 'status'; readonly text: string }
  | { readonly kind: 'failure'; readonly detail: string };

function main(): void {
  try {
    stop(getOutcome(process.argv.slice(2)));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the program` });
  }
}

// The data dir and the session id come from the two arguments, never from the
// environment, so the status reads where the gate reads.
function getOutcome(args: readonly string[]): Outcome {
  const [dataDir, sessionId, ...extra] = args;

  if (dataDir === undefined || dataDir === '' || !isSafeId(sessionId) || extra.length > 0) {
    return { kind: 'failure', detail: USAGE };
  }

  return { kind: 'status', text: getStatus(dataDir, sessionId) };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'status':
      writeSync(process.stdout.fd, outcome.text);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

main();
