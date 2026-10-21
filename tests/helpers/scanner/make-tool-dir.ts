import { execFileSync } from 'node:child_process';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';

const LOOKUP_TIMEOUT_MS = 10000;

// A temporary directory that links only the named tools, found on the
// caller's PATH, so that a PATH made of this directory has no scanner on it
// wherever the machine keeps one.
export function makeToolDir(t: TestContext, toolNames: readonly string[]): string {
  const directory = makeTempDir(t);

  for (const toolName of toolNames) {
    const toolPath = execFileSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', toolName], {
      encoding: 'utf8',
      timeout: LOOKUP_TIMEOUT_MS,
    }).trim();

    symlinkSync(toolPath, join(directory, toolName));
  }

  return directory;
}
