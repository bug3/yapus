import { writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { type Context, CONTRACT_PATH, getContext } from './get-context.ts';

const PROGRAM = 'providens contract';

function main(): void {
  try {
    stop(getContext(CONTRACT_PATH));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

function stop(context: Context): never {
  process.exit(write(context));
}

// writeSync, because process.exit can drop a pending write to a pipe. Exit
// 2 at SubagentStart cannot stop the subagent; it shows the person the error.
function write(context: Context): 0 | 2 {
  switch (context.kind) {
    case 'output':
      writeSync(process.stdout.fd, `${ context.json }\n`);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, context.detail) }\n`);

      return 2;
  }
}

main();
