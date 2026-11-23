import { existsSync, statSync } from 'node:fs';

// Whether the path leads to a file. Asked of existsSync first, which answers
// false where a stat throws: a path that runs through a file.
export function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}
