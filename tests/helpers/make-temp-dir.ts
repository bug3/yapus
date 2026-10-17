import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';

// A fresh directory under the system temp directory, removed when the test ends.
export function makeTempDir(t: TestContext): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'yapus-'));

  t.after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  return tempDir;
}
