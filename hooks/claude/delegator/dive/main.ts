import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { formatRunStats } from './format-run-stats.ts';
import { getAgentUsages } from './get-agent-usages.ts';

const PROGRAM = 'delegator dive';
const USAGE =
  'usage: delegator dive <run directory>; give the directory of one workflow run and nothing else';
const READ_ADVICE = 'give the directory of one workflow run';

type Outcome =
  | { readonly kind: 'report'; readonly markdown: string }
  | { readonly kind: 'failure'; readonly detail: string };

function main(): void {
  try {
    stop(getOutcome(process.argv.slice(2)));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the program` });
  }
}

function getOutcome(args: readonly string[]): Outcome {
  const [runDirectory, ...extra] = args;

  if (runDirectory === undefined || extra.length > 0) {
    return { kind: 'failure', detail: USAGE };
  }

  const run = getAgentUsages(runDirectory);

  switch (run.kind) {
    case 'usages':
      return { kind: 'report', markdown: formatRunStats(run.usages) };
    case 'failure':
      return { kind: 'failure', detail: `${ run.detail }; ${ READ_ADVICE }` };
  }
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'report':
      writeSync(process.stdout.fd, outcome.markdown);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

main();
