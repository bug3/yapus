import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isRecord } from '../../../../../hooks/shared/is-record.ts';
import { readPins } from '../../../../../hooks/landmark/repo/package/read-pins.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');

test('keeps the pins equal to the devDependencies of the repository package.json', () => {
  const manifest: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

  assert.ok(isRecord(manifest));
  assert.deepEqual(manifest.devDependencies, readPins());
});

test('keeps pins.json in canonical form', () => {
  const path = join(ROOT, 'hooks', 'landmark', 'repo', 'package', 'pins.json');

  assert.equal(
    readFileSync(path, 'utf8'),
    `${ JSON.stringify(readPins(), undefined, 2) }\n`,
  );
});
