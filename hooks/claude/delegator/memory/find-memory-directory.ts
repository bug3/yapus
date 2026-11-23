import { existsSync, statSync } from 'node:fs';
import { getMemoryDirectory } from './get-memory-directory.ts';

// The project's memory directory, or undefined where the project holds none:
// no project root, no such path, or a file in its place.
export function findMemoryDirectory(projectRoot: string | undefined): string | undefined {
  if (projectRoot === undefined || projectRoot === '') {
    return undefined;
  }

  const memoryDirectory = getMemoryDirectory(projectRoot);

  // Asked of existsSync first, which answers false where a stat throws: a
  // path that runs through a file.
  return existsSync(memoryDirectory) && statSync(memoryDirectory).isDirectory()
    ? memoryDirectory
    : undefined;
}
