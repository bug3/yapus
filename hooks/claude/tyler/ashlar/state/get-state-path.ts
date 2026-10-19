import { join } from 'node:path';

// Where ashlar keeps a file of its state: <dataDir>/ashlar/<name>.
export function getStatePath(dataDir: string, name: string): string {
  return join(dataDir, 'ashlar', name);
}
