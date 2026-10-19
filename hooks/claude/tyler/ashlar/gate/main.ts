import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../../shared/format-message.ts';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../../shared/get-within-limit.ts';
import { parseHookInput } from '../parse-hook-input.ts';
import { getGateVerdict } from './get-gate-verdict.ts';

const PROGRAM = 'providens review';
const LIMIT_SECONDS = 5;

interface Outcome {
  readonly code: 0 | 2;
  readonly detail?: string;
}

async function main(): Promise<void> {
  try {
    const { env } = process;
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(decide(stdinText, env));
  } catch (error) {
    stop(sendBack(`crashed: ${ getFirstLine(error) }; fix the hook`));
  }
}

function decide(stdinText: string | undefined, env: NodeJS.ProcessEnv): Outcome {
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

  const verdict = getGateVerdict(input, { dataDir, env, time: new Date().toISOString() });

  switch (verdict.kind) {
    case 'pass':
      return { code: 0 };
    case 'review':
      return sendBack(verdict.detail);
    case 'failure':
      return fail(verdict.detail);
  }
}

// Exit 2 at Stop sends the session back with the message.
function sendBack(detail: string): Outcome {
  return { code: 2, detail };
}

// On the retry a hook failure lets the session stop, as it must not hold a
// session that was already sent back once.
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
