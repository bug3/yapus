import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../hooks/shared/is-record.ts';

const PLUGIN = join(import.meta.dirname, '..', '..', '..', 'plugins', 'ordo');
const STANDARDS = join(PLUGIN, 'standards');
const PATHS_ENTRY = /^ {2}- "([^"]+)"$/;
const ANY_DIRECTORY = '**/';

const PARSED: unknown = JSON.parse(readFileSync(join(PLUGIN, 'paths.json'), 'utf8'));
const MAP = isRecord(PARSED) && isRecord(PARSED.map) ? PARSED.map : {};
const KEEP: unknown = isRecord(PARSED) ? PARSED.keep : [];

test('places every paths entry under any directory, in the map or in keep, not both', () => {
  const misplaced = readdirSync(STANDARDS)
    .flatMap((name) => getEntries(name).map((entry) => `${ name }: ${ entry }`))
    .filter((line) => !isPlaced(line.split(': ')[1] ?? ''));

  assert.deepEqual(misplaced, []);
});

test('leaves every standard that has paths with at least one path after the rewrite', () => {
  const emptied = readdirSync(STANDARDS)
    .filter((name) => getEntries(name).length > 0)
    .filter((name) => getEntries(name).every((entry) => typeof getRewritten(entry) !== 'string'));

  assert.deepEqual(emptied, []);
});

function getEntries(name: string): string[] {
  return readFileSync(join(STANDARDS, name), 'utf8')
    .split('\n')
    .flatMap((line) => PATHS_ENTRY.exec(line)?.[1] ?? []);
}

function isPlaced(entry: string): boolean {
  const homeCount = [Object.hasOwn(MAP, entry), Array.isArray(KEEP) && KEEP.includes(entry)]
    .filter(Boolean).length;

  return entry.startsWith(ANY_DIRECTORY) || homeCount === 1;
}

function getRewritten(entry: string): unknown {
  return Object.hasOwn(MAP, entry) ? MAP[entry] : entry;
}
