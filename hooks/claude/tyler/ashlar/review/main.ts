import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../../shared/get-within-limit.ts';
import { parseHookInput } from '../parse-hook-input.ts';
import { getReviewOutcome } from './get-review-outcome.ts';

const PROGRAM = 'providens review';
const LIMIT_SECONDS = 5;

interface Failure {
  readonly detail: string;
  readonly isRetry: boolean;
}

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(getFailure(stdinText, process.env.CLAUDE_PLUGIN_DATA));
  } catch (error) {
    stop({ detail: `crashed: ${ getFirstLine(error) }; fix the hook`, isRetry: false });
  }
}

// What failed, or undefined after the review step passes.
function getFailure(
  stdinText: string | undefined,
  dataDir: string | undefined,
): Failure | undefined {
  if (stdinText === undefined) {
    return { detail: `no input within ${ String(LIMIT_SECONDS) } seconds; retry`, isRetry: false };
  }

  const parsed = parseHookInput(stdinText);

  if (parsed.kind === 'failure') {
    return { detail: `${ parsed.reason }; fix the hook input`, isRetry: parsed.isRetry };
  }

  const { input } = parsed;

  if (dataDir === undefined || dataDir === '') {
    return {
      detail: 'CLAUDE_PLUGIN_DATA is not set; reinstall the plugin',
      isRetry: input.isRetry,
    };
  }

  const outcome = getReviewOutcome(input, {
    dataDir,
    env: process.env,
    time: new Date().toISOString(),
  });

  return outcome.kind === 'pass' ? undefined : { detail: outcome.detail, isRetry: input.isRetry };
}

function stop(failure: Failure | undefined): never {
  process.exit(write(failure));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(failure: Failure | undefined): 0 | 2 {
  if (failure === undefined) {
    return 0;
  }

  writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, failure.detail) }\n`);

  // Warden was already sent back once, so a second send-back could loop.
  if (failure.isRetry) {
    return 0;
  }

  // At SubagentStop, 2 sends warden back once with the message.
  return 2;
}

await main();
