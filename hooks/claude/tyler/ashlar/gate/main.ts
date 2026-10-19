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
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(decide(stdinText, process.env.CLAUDE_PLUGIN_DATA));
  } catch (error) {
    stop(fail(`crashed: ${ getFirstLine(error) }; fix the hook`, false));
  }
}

function decide(stdinText: string | undefined, dataDir: string | undefined): Outcome {
  if (stdinText === undefined) {
    return fail(`no input within ${ String(LIMIT_SECONDS) } seconds; retry`, false);
  }

  const parsed = parseHookInput(stdinText);

  if (parsed.kind === 'failure') {
    return fail(`${ parsed.reason }; fix the hook input`, parsed.isRetry);
  }

  if (dataDir === undefined || dataDir === '') {
    return fail('CLAUDE_PLUGIN_DATA is not set; reinstall the plugin', parsed.input.isRetry);
  }

  const verdict = getGateVerdict(parsed.input, {
    dataDir,
    env: process.env,
    time: new Date().toISOString(),
  });

  switch (verdict.kind) {
    case 'pass':
      return { code: 0 };
    case 'review':
      // Exit 2 at Stop sends the session back with the message.
      return { code: 2, detail: verdict.detail };
    case 'failure':
      return fail(verdict.detail, parsed.input.isRetry);
  }
}

// Exit 2 sends the session back; on the retry exit 0 lets it stop, as a hook
// failure must not hold a session that was already sent back once.
function fail(detail: string, isRetry: boolean): Outcome {
  return { code: isRetry ? 0 : 2, detail };
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(outcome: Outcome): never {
  if (outcome.detail !== undefined) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);
  }

  process.exit(outcome.code);
}

await main();
