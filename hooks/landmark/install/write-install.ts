import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from './read-plugin.ts';

// Writes the rule files and the version stamp under home; returns the paths.
export function writeInstall(home: string, plugin: Plugin): string[] {
  const rulesDir = join(home, '.claude', 'rules');
  const stampDir = join(home, '.claude', 'landmark');
  const stamp = join(stampDir, 'version');

  mkdirSync(rulesDir, { recursive: true });
  mkdirSync(stampDir, { recursive: true });

  const rulePaths = plugin.rules.map(({ fileName, text }) => {
    const path = join(rulesDir, fileName);

    writeFileSync(path, text);

    return path;
  });

  writeFileSync(stamp, plugin.version);

  return [...rulePaths, stamp];
}
