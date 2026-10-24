import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from './read-plugin.ts';

// Writes the rule files under home; returns the paths.
export function writeRules(home: string, plugin: Plugin): string[] {
  const rulesDir = join(home, '.claude', 'rules');

  mkdirSync(rulesDir, { recursive: true });

  return plugin.rules.map(({ fileName, text }) => {
    const path = join(rulesDir, fileName);

    writeFileSync(path, text);

    return path;
  });
}
