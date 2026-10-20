import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { getVerdict, type Verdict } from './get-verdict.ts';

const PROGRAM = 'providens git';
const LIMIT_SECONDS = 3;

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(stdinText === undefined
      ? { kind: 'deny', detail: `stdin did not arrive within ${ String(LIMIT_SECONDS) } s` }
      : getVerdict({ stdinText, home: process.env.HOME }));
  } catch (error) {
    stop({ kind: 'deny', detail: `crashed: ${ getFirstLine(error) }` });
  }
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Bash call and shows Claude the reason on stderr.
// writeSync, because process.exit can drop a pending write to a pipe.
function write(verdict: Verdict): 0 | 2 {
  switch (verdict.kind) {
    case 'allow':
      return 0;
    case 'deny':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.detail) }\n`);

      return 2;
  }
}

await main();
