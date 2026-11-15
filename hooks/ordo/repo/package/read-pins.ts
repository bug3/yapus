import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isJsonObject } from './is-json-object.ts';

// The six devDependency pins, name to exact version; throws when pins.json is
// anything else.
export function readPins(): Readonly<Record<string, string>> {
  const path = join(import.meta.dirname, 'pins.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const isPins = isJsonObject(parsed)
    && Object.values(parsed).every((version) => typeof version === 'string');

  if (!isPins) {
    throw new Error('pins.json is not an object of strings');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([name, version]) => [name, String(version)]),
  );
}
