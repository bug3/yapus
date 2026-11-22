import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../make-temp-dir.ts';

// A fresh temporary home whose ordo exclusion list holds roots as one JSON
// line, removed when the test ends.
export function makeListingHome(t: TestContext, roots: readonly string[]): string {
  return makeHomeWithListText(t, `${ JSON.stringify(roots) }\n`);
}

// A fresh temporary home whose ordo exclusion list holds listText as it is,
// valid or not, removed when the test ends.
export function makeHomeWithListText(t: TestContext, listText: string): string {
  const home = makeTempDir(t);
  const directory = join(home, '.claude', 'yapus', 'ordo');

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'excluded.json'), listText);

  return home;
}
