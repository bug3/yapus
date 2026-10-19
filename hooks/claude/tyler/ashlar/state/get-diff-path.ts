import { join } from 'node:path';
import { getStatePath } from './get-state-path.ts';

// The file a change's diff is written to: in the scratchpad when the session
// has one, else under <dataDir>/ashlar. It builds the path and writes nothing.
export function getDiffPath(
  scratchpadDir: string | undefined,
  dataDir: string,
  sessionId: string,
): string {
  if (scratchpadDir !== undefined && scratchpadDir !== '') {
    return join(scratchpadDir, `ashlar-${ sessionId }.diff`);
  }

  return getStatePath(dataDir, `${ sessionId }.diff`);
}
