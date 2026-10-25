import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRulesDir } from '../../shared/hooks-path/get-rules-dir.ts';
import type { Plugin } from './read-plugin.ts';

// Writes the rule files under home and removes every other .md file of the
// directory, so the rule of a dropped standard leaves; returns the paths.
export function writeRules(home: string, plugin: Plugin): string[] {
  const rulesDir = getRulesDir(home);
  const current = new Set(plugin.rules.map(({ fileName }) => fileName));

  mkdirSync(rulesDir, { recursive: true });

  readdirSync(rulesDir)
    .filter((name) => name.endsWith('.md') && !current.has(name))
    .forEach((name) => {
      rmSync(join(rulesDir, name));
    });

  return plugin.rules.map(({ fileName, text }) => {
    const path = join(rulesDir, fileName);

    writeFileSync(path, text);

    return path;
  });
}
