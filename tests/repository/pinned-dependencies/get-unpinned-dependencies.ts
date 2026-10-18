import { join } from 'node:path';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const MANIFEST = 'package.json';
const DEPENDENCY_FIELDS: readonly string[] = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

// Every dependency of the manifest under root whose version is not one exact
// version, as "<field>.<name>: <version>".
export function getUnpinnedDependencies(root: string): string[] {
  const manifest = readJson(join(root, MANIFEST));

  return DEPENDENCY_FIELDS.flatMap((field) => getUnpinned(field, getField(manifest, field)));
}

function getUnpinned(field: string, dependencies: unknown): string[] {
  if (!isRecord(dependencies)) {
    return [];
  }

  return Object.entries(dependencies)
    .filter(([, version]) => typeof version !== 'string' || !EXACT_VERSION.test(version))
    .map(([name, version]) => `${ field }.${ name }: ${ String(version) }`);
}

// The parsed file, or undefined when it is missing or not JSON.
function readJson(path: string): unknown {
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
