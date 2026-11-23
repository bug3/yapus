import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getWithinLimit } from '../../../shared/get-within-limit.ts';
import { type Call, getHandover } from '../../delegator/memory/handover/get-handover.ts';
import { getVerdict, PASS, refuse, type Verdict } from './get-verdict.ts';
import { holdsEvent, readGhEvents } from './handover/read-gh-events.ts';
import { parsePayload } from './input/parse-payload.ts';

const PROGRAM = 'gh check';
const LIMIT_SECONDS = 3;

async function main(): Promise<void> {
  try {
    const stdinText = await getWithinLimit(text(process.stdin), LIMIT_SECONDS);
    const home = process.env.HOME ?? '';

    if (stdinText === undefined) {
      stop(refuse(`stdin did not arrive within ${ String(LIMIT_SECONDS) } s; retry the call`));
    }

    const verdict = await judge(stdinText, home, process.env);

    if (verdict.kind === 'pass') {
      handOver({
        stdinText,
        dataDir: process.env.CLAUDE_PLUGIN_DATA,
        projectDir: process.env.CLAUDE_PROJECT_DIR,
      });
    }

    stop(verdict);
  } catch (error) {
    stop(refuse(`crashed: ${ getFirstLine(error) }; retry the call, `
      + 'or the person fixes the hook'));
  }
}

async function judge(stdinText: string, home: string, env: NodeJS.ProcessEnv): Promise<Verdict> {
  const payload = parsePayload(stdinText);

  switch (payload.kind) {
    case 'call':
      return getVerdict(payload.command, payload.cwd, { home, env });
    case 'other':
      return PASS;
    case 'failure':
      return refuse(`cannot read the tool call (${ payload.reason }); retry the call`);
  }
}

// Writes the rules of the project's memory that name a gh command a passed
// Bash call runs. An error in the reading or in the write leaves the verdict
// as it is, so the hand-over adds no way to block a call.
function handOver(call: Call): void {
  try {
    const payload = parsePayload(call.stdinText);
    const ghEvents = payload.kind === 'call' ? readGhEvents(payload.command) : [];
    const handover = getHandover(call, (event) => holdsEvent(ghEvents, event));

    if (handover !== undefined) {
      writeSync(process.stdout.fd, `${ handover }\n`);
    }
  } catch {
    // Nothing is handed.
  }
}

function stop(verdict: Verdict): never {
  process.exit(write(verdict));
}

// Exit 2 blocks the Bash call and shows the agent the reason on stderr.
// writeSync, because process.exit can drop a pending write to a pipe.
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
