import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getVerdict, PASS, refuse, type Verdict } from './get-verdict.ts';
import { parsePayload } from './input/parse-payload.ts';

const PROGRAM = 'gh check';
const LIMIT_SECONDS = 3;

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(stdinText === undefined
      ? refuse(`stdin did not arrive within ${ String(LIMIT_SECONDS) } s; retry the call`)
      : judge(stdinText));
  } catch (error) {
    stop(refuse(`crashed: ${ getFirstLine(error) }; retry the call, or a person fixes the hook`));
  }
}

function judge(stdinText: string): Verdict {
  const payload = parsePayload(stdinText);

  switch (payload.kind) {
    case 'call':
      return getVerdict(payload.command, payload.cwd);
    case 'other':
      return PASS;
    case 'failure':
      return refuse(`cannot read the tool call (${ payload.reason }); retry the call`);
  }
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Bash call and shows Claude the reason on stderr. writeSync,
// because process.exit can drop a pending write to a pipe.
function write(verdict: Verdict): 0 | 2 {
  switch (verdict.kind) {
    case 'pass':
      return 0;
    case 'refuse':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.reason) }\n`);

      return 2;
  }
}

await main();
