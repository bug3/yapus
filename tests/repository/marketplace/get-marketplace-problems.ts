import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const MARKETPLACE = '.claude-plugin/marketplace.json';
const MANIFEST = '.claude-plugin/plugin.json';
const LOCAL_SOURCE = /^\.\/[a-z0-9/-]+$/;

// Every way the marketplace under root fails to list a plugin of this
// repository that carries its own manifest; the commit sha versions the
// plugins, so neither file may carry a version.
export function getMarketplaceProblems(root: string): string[] {
  const plugins = getField(readJson(join(root, MARKETPLACE)), 'plugins');

  if (!Array.isArray(plugins)) {
    return [`${ MARKETPLACE }: missing, not JSON or without a plugins list`];
  }

  return plugins.flatMap((entry: unknown) => getEntryProblems(root, entry));
}

function getEntryProblems(root: string, entry: unknown): string[] {
  const name = String(getField(entry, 'name'));
  const source = getField(entry, 'source');

  if (typeof source !== 'string' || !LOCAL_SOURCE.test(source)) {
    return [`${ name }: source is not a ./ path in this repository`];
  }

  const manifest = readJson(join(root, source, MANIFEST));

  if (manifest === undefined) {
    return [`${ name }: ${ source }/${ MANIFEST } is missing or not JSON`];
  }

  const isNamedAlike = getField(manifest, 'name') === name;

  return [
    ...hasVersion(entry) ? [`${ name }: the marketplace entry carries a version`] : [],
    ...hasVersion(manifest) ? [`${ name }: ${ MANIFEST } carries a version`] : [],
    ...isNamedAlike ? [] : [`${ name }: ${ MANIFEST } names another plugin`],
  ];
}

function hasVersion(value: unknown): boolean {
  return getField(value, 'version') !== undefined;
}

// The parsed file, or undefined when it is missing or not JSON.
function readJson(path: string): unknown {
  if (!existsSync(path)) {
    return undefined;
  }

  const text = readUtf8(path);

  if (text === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function getField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
