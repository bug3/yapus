import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';
import type { TempFile } from '../make-temp-repo.ts';

// A fresh temporary project root whose memory directory, .yapus/memory, holds
// each file at its path relative to that directory, with its directories,
// removed when the test ends. With no file the directory is there and empty.
export function makeMemoryProject(t: TestContext, files: readonly TempFile[]): string {
  const projectRoot = makeTempDir(t);
  const memoryDirectory = join(projectRoot, '.yapus', 'memory');

  mkdirSync(memoryDirectory, { recursive: true });

  for (const { path, text } of files) {
    mkdirSync(join(memoryDirectory, dirname(path)), { recursive: true });
    writeFileSync(join(memoryDirectory, path), text);
  }

  return projectRoot;
}
