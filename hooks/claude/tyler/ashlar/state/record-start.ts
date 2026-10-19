import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getStatePath } from './get-state-path.ts';

export const START_SUFFIX = '.start';

// Notes the session's start time in <dataDir>/ashlar/<sessionId>.start. A
// resumed session keeps the start it first noted, so an existing file stays.
export function recordStart(dataDir: string, sessionId: string, time: Date): void {
  const path = getStatePath(dataDir, `${ sessionId }${ START_SUFFIX }`);

  if (existsSync(path)) {
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, time.toISOString());
}
