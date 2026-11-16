import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../../../hooks/shared/is-record.ts';
import { readPins } from '../../../../../hooks/ordo/repo/package/read-pins.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');

// The docs site's generator, which ordo never writes into a repository.
const REPOSITORY_ONLY: readonly string[] = ['vitepress'];

test('keeps the pins equal to the devDependencies of the repository package.json', () => {
  const manifest: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

  assert.ok(isRecord(manifest));
  assert.ok(isRecord(manifest.devDependencies));

  const pinned = Object.entries(manifest.devDependencies)
    .filter(([name]) => !REPOSITORY_ONLY.includes(name));

  assert.deepEqual(Object.fromEntries(pinned), readPins());
});

test('keeps pins.json in canonical form', () => {
  const path = join(ROOT, 'hooks', 'ordo', 'repo', 'package', 'pins.json');

  assert.equal(
    readFileSync(path, 'utf8'),
    `${ JSON.stringify(readPins(), undefined, 2) }\n`,
  );
});
