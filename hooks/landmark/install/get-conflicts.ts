import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// What stops an install into home, one sentence each; empty when nothing does.
export function getConflicts(home: string): string[] {
  const rulesDir = join(home, '.claude', 'rules');
  const stamp = join(home, '.claude', 'landmark', 'version');
  const ruleFiles = existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((name) => /^landmark-.*\.md$/.test(name))
    : [];

  return [
    ...existsSync(stamp) ? [`${ stamp } exists; use /landmark:upgrade`] : [],
    ...ruleFiles.map((name) => `${ join(rulesDir, name) } exists; remove it first`),
  ];
}
