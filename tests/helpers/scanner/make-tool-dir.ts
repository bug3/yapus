import { execFileSync } from 'node:child_process';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';

const LOOKUP_TIMEOUT_MS = 10000;
const EXECUTABLE = 0o755;

// A temporary directory that holds only the named tools, found on the
// caller's PATH, so that a PATH made of this directory has no scanner on it
// wherever the machine keeps one. Each tool is a script that runs the real
// one, since a tool such as npm finds its files beside the path it was
// started by, and a link would hide them.
export function makeToolDir(t: TestContext, toolNames: readonly string[]): string {
  const directory = makeTempDir(t);

  for (const toolName of toolNames) {
    const toolPath = execFileSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', toolName], {
      encoding: 'utf8',
      timeout: LOOKUP_TIMEOUT_MS,
    }).trim();

    writeFileSync(join(directory, toolName), `#!/bin/sh\nexec '${ toolPath }' "$@"\n`);
    chmodSync(join(directory, toolName), EXECUTABLE);
  }

  return directory;
}
