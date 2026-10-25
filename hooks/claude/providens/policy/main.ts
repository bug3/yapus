import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { type Context, getContext, POLICY_PATH } from './get-context.ts';
import { isSessionOff } from './is-session-off.ts';

const PROGRAM = 'providens policy';
const LIMIT_SECONDS = 5;

// Silence is a session switched off: the hook prints nothing.
type Outcome = Context | { readonly kind: 'silence' };

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(isSessionOff(stdinText, process.env.CLAUDE_PLUGIN_DATA)
      ? { kind: 'silence' }
      : getContext(POLICY_PATH));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

function stop(context: Outcome): never {
  process.exit(write(context));
}

// writeSync, because process.exit can drop a pending write to a pipe. Exit
// 2 at SessionStart cannot stop the session; it shows the person the error.
function write(context: Outcome): 0 | 2 {
  switch (context.kind) {
    case 'silence':
      return 0;
    case 'output':
      writeSync(process.stdout.fd, `${ context.json }\n`);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, context.detail) }\n`);

      return 2;
  }
}

await main();
