import { readFileSync, writeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { RETURN_WORDS_PATH, readReturnWords } from '../contract/read-return-words.ts';
import { RECORD_FILE } from '../record-row.ts';
import { getReport } from './get-report.ts';

const PROGRAM = 'delegator report';
// Where Claude Code keeps the data of a plugin installed from the yapus
// marketplace, when neither the argument nor CLAUDE_PLUGIN_DATA names it.
const DEFAULT_DATA_DIR = join(homedir(), '.claude', 'plugins', 'data', 'delegator-yapus');

type Outcome =
  | { readonly kind: 'report'; readonly markdown: string }
  | { readonly kind: 'failure'; readonly detail: string };

function main(): void {
  try {
    stop(getOutcome(readInput()));
  } catch (error) {
    stop({ kind: 'failure', detail: `crashed: ${ getFirstLine(error) }; fix the program` });
  }
}

// The record file: in the directory given as the argument, else in
// CLAUDE_PLUGIN_DATA, else in the default directory.
function readInput(): string {
  const dataDir = process.argv[2] ?? process.env.CLAUDE_PLUGIN_DATA ?? DEFAULT_DATA_DIR;

  return join(dataDir, RECORD_FILE);
}

function getOutcome(path: string): Outcome {
  const words = readReturnWords(RETURN_WORDS_PATH);

  if ('violation' in words) {
    return { kind: 'failure', detail: words.violation };
  }

  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  return { kind: 'report', markdown: getReport(path, text, words) };
}

function stop(outcome: Outcome): never {
  process.exit(write(outcome));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function write(outcome: Outcome): 0 | 2 {
  switch (outcome.kind) {
    case 'report':
      writeSync(process.stdout.fd, outcome.markdown);

      return 0;
    case 'failure':
      writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, outcome.detail) }\n`);

      return 2;
  }
}

main();
