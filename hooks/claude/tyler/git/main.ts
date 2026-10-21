import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { type Context, makeContext } from './context/make-context.ts';
import { getVerdict, type Verdict } from './get-verdict.ts';
import { parsePayload } from './input/parse-payload.ts';

const PROGRAM = 'providens git';
const LIMIT_SECONDS = 3;

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);

    stop(stdinText === undefined
      ? { kind: 'deny', detail: `stdin did not arrive within ${ String(LIMIT_SECONDS) } s` }
      : getVerdict({ stdinText, home: process.env.HOME }, makeContextOf(stdinText)));
  } catch (error) {
    stop({ kind: 'deny', detail: `crashed: ${ getFirstLine(error) }` });
  }
}

// The deadline of every child process starts now, after the stdin read.
function makeContextOf(stdinText: string): Context {
  const payload = parsePayload(stdinText);

  return makeContext(payload.kind === 'call' ? payload.cwd : undefined);
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Bash call and shows Claude the reason on stderr; notes of an
// allowed call go to Claude on stdout. writeSync, because process.exit can drop a
// pending write to a pipe.
function write(verdict: Verdict): 0 | 2 {
  switch (verdict.kind) {
    case 'allow':
      if (verdict.notes !== undefined) {
        writeSync(process.stdout.fd, `${ JSON.stringify(makeNotesOutput(verdict.notes)) }\n`);
      }

      return 0;
    case 'deny':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, verdict.detail) }\n`);

      return 2;
  }
}

function makeNotesOutput(notes: readonly string[]): object {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: notes.join('\n\n'),
    },
  };
}

await main();
