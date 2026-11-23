import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getConfigDirectory } from '../../delegator/memory/auto/get-config-directory.ts';
import { isSessionOff } from '../../delegator/policy/is-session-off.ts';
import { getVerdict, type Input, type Verdict } from './get-verdict.ts';

const PROGRAM = 'delegator memory';
const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    const input = await getWithinLimit(readInput(), LIMIT_SECONDS);

    stop(input === undefined
      ? { kind: 'failure', detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry` }
      : getVerdict(input));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the hook` });
  }
}

async function readInput(): Promise<Input> {
  const stdinText = await text(process.stdin);

  return {
    stdinText,
    isOff: isSessionOff(stdinText, process.env.CLAUDE_PLUGIN_DATA),
    projectRoot: process.env.CLAUDE_PROJECT_DIR,
    configDirectory: getConfigDirectory(process.env),
  };
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// A refusal leaves at exit 0 as the JSON that denies the call, and exit 2 is
// kept for a failure: the hook is registered so that every exit but 0 lets
// the write through. writeSync, because process.exit can drop a pending
// write to a pipe.
function write(verdict: Verdict): 0 | 2 {
  switch (verdict.kind) {
    case 'allow':
      return 0;
    case 'deny':
      writeSync(process.stdout.fd, `${ JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: verdict.reason,
        },
      }) }\n`);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.detail) }\n`);

      return 2;
  }
}

await main();
