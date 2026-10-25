import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from '../../shared/is-record.ts';
import { readPluginVersion } from '../../shared/read-plugin-version.ts';
import { renderStandard } from './render-standard.ts';

export interface Rule {
  readonly fileName: string;
  readonly text: string;
}

export interface Plugin {
  readonly version: string;
  readonly rules: readonly Rule[];
}

// The version of the plugin at root and each of its standards, rendered as
// the rule file it becomes; throws when the manifest or the catalog is not
// the expected JSON.
export function readPlugin(root: string): Plugin {
  const version = readPluginVersion(root);
  const catalog: unknown = readJson(join(root, 'paths.json'));

  if (!isRecord(catalog) || !isRecord(catalog.map)) {
    throw new Error('paths.json has no map object');
  }

  const rendering = { map: catalog.map };
  const standardsDir = join(root, 'standards');
  const rules = readdirSync(standardsDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort()
    .map((fileName) => ({
      fileName: fileName.toLowerCase(),
      text: renderStandard(readFileSync(join(standardsDir, fileName), 'utf8'), rendering),
    }));

  return { version, rules };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}
