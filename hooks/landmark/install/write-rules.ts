import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRulesDirectory } from '../../shared/hooks-path/get-rules-directory.ts';
import type { Plugin } from './read-plugin.ts';

// Writes the rule files under home and removes every other regular .md file of
// the directory, so the rule of a dropped standard leaves; returns the paths.
export function writeRules(home: string, plugin: Plugin): string[] {
  const rulesDirectory = getRulesDirectory(home);
  const current = new Set(plugin.rules.map(({ fileName }) => fileName));

  mkdirSync(rulesDirectory, { recursive: true });

  readdirSync(rulesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !current.has(entry.name))
    .forEach((entry) => {
      rmSync(join(rulesDirectory, entry.name));
    });

  return plugin.rules.map(({ fileName, text }) => {
    const path = join(rulesDirectory, fileName);

    writeFileSync(path, text);

    return path;
  });
}
