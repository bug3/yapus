import { writeSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import { getExclusion } from '../../shared/exclusion/get-exclusion.ts';
import { formatMessage } from '../../shared/format-message.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getWithinLimit } from '../../shared/get-within-limit.ts';
import { type BranchInput, getBranchViolation } from './get-branch-violation.ts';

const PROGRAM = 'branch';
const STDIN_LIMIT_SECONDS = 5;
const NO_STDIN = `no ref lines within ${
  String(STDIN_LIMIT_SECONDS) } seconds; the branch is refused, retry it`;

async function main(): Promise<void> {
  try {
    if (isExcluded()) {
      stop(undefined);
    }

    const branchInput = await readBranchInput();

    stop(branchInput === undefined ? NO_STDIN : await getBranchViolation(branchInput));
  } catch (error) {
    stop(`crashed: ${ getFirstLine(error) }; the branch is refused, fix the hook`);
  }
}

// ordo checks nothing in a project on the exclusion list under HOME; git runs
// the hook inside the repository, whose main root the list holds.
function isExcluded(): boolean {
  return getExclusion(process.cwd(), process.env.HOME ?? '', process.env).kind === 'excluded';
}

// git runs the hook where the command runs, inside the repository, and its
// environment (GIT_DIR in a linked worktree) points git at the same one.
async function readBranchInput(): Promise<BranchInput | undefined> {
  const stdinText = await getWithinLimit(text(process.stdin), STDIN_LIMIT_SECONDS);

  return stdinText === undefined
    ? undefined
    : { stdinText, env: process.env, repository: process.cwd() };
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(violation: string | undefined): never {
  if (violation !== undefined) {
    writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, violation) }\n`);
  }

  process.exit(violation === undefined ? 0 : 2);
}

await main();
