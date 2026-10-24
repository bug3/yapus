import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from './is-record.ts';

// The version in the manifest of the plugin at root; throws when the manifest
// is not JSON or has no version string.
export function readPluginVersion(root: string): string {
  const manifest: unknown = JSON.parse(
    readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'),
  );

  if (!isRecord(manifest) || typeof manifest.version !== 'string') {
    throw new Error('plugin.json has no version string');
  }

  return manifest.version;
}
