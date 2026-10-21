import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';

const SCANNER_NAME = 'gitleaks';
const EXECUTABLE = 0o755;
// Answers every call the same way and appends the arguments of each call, as
// one line, to a log beside it.
const SCRIPT = `#!/usr/bin/env bash
set -u
dir=$(cd -P "$(dirname "\${BASH_SOURCE[0]}")" && pwd) || exit 70
printf '%s\\n' "$*" >> "$dir/arguments.log"
env | grep '^GITLEAKS_' > "$dir/variables.log"
cat "$dir/stdout"
cat "$dir/stderr" >&2
exit "$(cat "$dir/exit-code")"
`;

export interface FakeAnswer {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface FakeScanner {
  // The directory that holds the fake, to put first on PATH.
  readonly directory: string;
  // The arguments of each call, one string per call, in order.
  readonly readCalls: () => string[];
  // The GITLEAKS_ variables of the environment of the last call, sorted.
  readonly readVariables: () => string[];
}

// The answer of a scanner that finds nothing.
export const CLEAN_ANSWER: FakeAnswer = { exitCode: 0, stdout: '[]\n', stderr: '' };

// A fake `gitleaks` in a temporary directory, removed when the test ends.
export function makeFakeScanner(t: TestContext, answer: FakeAnswer): FakeScanner {
  const directory = makeTempDir(t);
  const logPath = join(directory, 'arguments.log');
  const variablesPath = join(directory, 'variables.log');

  writeFileSync(join(directory, SCANNER_NAME), SCRIPT);
  chmodSync(join(directory, SCANNER_NAME), EXECUTABLE);
  writeFileSync(join(directory, 'stdout'), answer.stdout);
  writeFileSync(join(directory, 'stderr'), answer.stderr);
  writeFileSync(join(directory, 'exit-code'), String(answer.exitCode));
  writeFileSync(logPath, '');
  writeFileSync(variablesPath, '');

  return {
    directory,
    readCalls: () => readLines(logPath),
    readVariables: () => readLines(variablesPath).sort(),
  };
}

function readLines(path: string): string[] {
  return readFileSync(path, 'utf8').split('\n').filter((line) => line !== '');
}
