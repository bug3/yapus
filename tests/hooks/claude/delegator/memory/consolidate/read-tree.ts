import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Every file below the directory, by path, each with its bytes as one
// character per byte, so two trees compare byte for byte.
export function readTree(root: string): [path: string, bytes: string][] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((listing) => listing.isFile())
    .map((listing) => join(listing.parentPath, listing.name))
    .sort()
    .map((path) => [relative(root, path), readFileSync(path, 'latin1')]);
}
