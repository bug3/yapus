import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../../shared/get-within-limit.ts';
import { parseHookInput } from '../parse-hook-input.ts';
import { getReviewOutcome } from './get-review-outcome.ts';

const PROGRAM = 'providens review';
const LIMIT_SECONDS = 5;
// The hook's timeout is 60 s; every git call ends by 40 s after the start.
const BUDGET_MS = 40_000;

interface Outcome {
  readonly code: 0 | 2;
  readonly detail?: string;
}

async function main(): Promise<void> {
  try {
    const deadline = Date.now() + BUDGET_MS;
    const { env } = process;
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(decide(stdinText, env, deadline));
  } catch (error) {
    stop(sendBack(`crashed: ${ getFirstLine(error) }; fix the hook`));
  }
}

function decide(
  stdinText: string | undefined,
  env: NodeJS.ProcessEnv,
  deadline: number,
): Outcome {
  if (stdinText === undefined) {
    return sendBack(`no input within ${ String(LIMIT_SECONDS) } seconds; retry`);
  }

  const parsed = parseHookInput(stdinText);

  if (parsed.kind === 'failure') {
    const failInput = parsed.isRetry ? letStop : sendBack;

    return failInput(`${ parsed.reason }; fix the hook input`);
  }

  const { input } = parsed;
  const fail = input.isRetry ? letStop : sendBack;
  const dataDir = env.CLAUDE_PLUGIN_DATA;

  if (dataDir === undefined || dataDir === '') {
    return fail('CLAUDE_PLUGIN_DATA is not set; reinstall the plugin');
  }

  const outcome = getReviewOutcome(input, {
    dataDir,
    env,
    time: new Date().toISOString(),
    deadline,
  });

  return outcome.kind === 'pass' ? { code: 0 } : fail(outcome.detail);
}

// At SubagentStop, 2 sends warden back once with the message.
function sendBack(detail: string): Outcome {
  return { code: 2, detail };
}

// Warden was already sent back once, so a second send-back could loop.
function letStop(detail: string): Outcome {
  return { code: 0, detail };
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(outcome: Outcome): never {
  if (outcome.detail !== undefined) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);
  }

  process.exit(outcome.code);
}

await main();
