import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPins } from '../../../../../hooks/landmark/project/package/read-pins.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');

test('keeps the pins equal to the devDependencies of the repository package.json', () => {
  assert.partialDeepStrictEqual(
    JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')),
    { devDependencies: readPins() },
  );
  assert.equal(Object.keys(readPins()).length, 6);
});

test('keeps pins.json in canonical form', () => {
  const path = join(ROOT, 'hooks', 'landmark', 'project', 'package', 'pins.json');

  assert.equal(
    readFileSync(path, 'utf8'),
    `${ JSON.stringify(readPins(), undefined, 2) }\n`,
  );
});
