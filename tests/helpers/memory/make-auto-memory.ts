import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';
import type { TempFile } from '../make-temp-repo.ts';

export interface AutoMemory {
  readonly configDirectory: string;
  readonly memoryDirectory: string;
}

// The name Claude Code gives the directory of a project at /work/app.
const SLUG = '-work-app';

// A fresh temporary configuration directory of Claude Code holding one auto
// memory directory, projects/<slug>/memory, with each file at its path in
// that directory, removed when the test ends.
export function makeAutoMemory(t: TestContext, files: readonly TempFile[]): AutoMemory {
  const configDirectory = makeTempDir(t);
  const memoryDirectory = join(configDirectory, 'projects', SLUG, 'memory');

  mkdirSync(memoryDirectory, { recursive: true });

  for (const { path, text } of files) {
    writeFileSync(join(memoryDirectory, path), text);
  }

  return { configDirectory, memoryDirectory };
}
