import { cpSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  CATALOGS_DIRECTORY,
} from '../../../../../hooks/claude/gates/gh/rules/read-gh-catalogs.ts';
import {
  CATALOGS_PATH,
} from '../../../../../hooks/claude/gates/gh/rules/read-repository-catalogs.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

// A temporary repository root that holds a copy of the repository's catalogs
// where the gh check looks for them.
export function makeCatalogRoot(t: TestContext): string {
  const root = makeTempDir(t);

  cpSync(CATALOGS_DIRECTORY, join(root, CATALOGS_PATH), { recursive: true });

  return root;
}
