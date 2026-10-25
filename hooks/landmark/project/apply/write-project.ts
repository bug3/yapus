import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ProjectPlan } from '../plan/get-project-plan.ts';

const PACKAGE = 'package.json';
const STAMP = '.landmark/version';

interface Writing {
  readonly plan: ProjectPlan;
  readonly packageText: string | undefined;
  readonly version: string;
}

// Removes, then writes the plan's files, package.json when it has a text, and
// the stamp last (a stamp at the new version claims all else is in place).
// Returns the written paths in that order.
export function writeProject(
  projectDir: string,
  { plan, packageText, version }: Writing,
): string[] {
  const files = [
    ...plan.writes,
    ...packageText === undefined ? [] : [{ target: PACKAGE, text: packageText }],
    { target: STAMP, text: version },
  ];

  for (const removal of plan.removals) {
    rmSync(join(projectDir, removal), { force: true });
  }

  for (const { target, text } of files) {
    mkdirSync(dirname(join(projectDir, target)), { recursive: true });
    writeFileSync(join(projectDir, target), text);
  }

  return files.map(({ target }) => target);
}
