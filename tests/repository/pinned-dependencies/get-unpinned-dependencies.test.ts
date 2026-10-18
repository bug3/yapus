import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getUnpinnedDependencies } from './get-unpinned-dependencies.ts';

test('finds nothing when every dependency names one exact version', (t) => {
  const root = makeManifest(t, '{ "devDependencies": { "a": "1.2.3" }, "dependencies": {} }\n');

  assert.deepEqual(getUnpinnedDependencies(root), []);
});

test('names a dependency with a range or a tag', (t) => {
  const root = makeManifest(t, '{ "devDependencies": { "a": "^1.2.3", "b": "latest" } }\n');

  assert.deepEqual(getUnpinnedDependencies(root), [
    'devDependencies.a: ^1.2.3',
    'devDependencies.b: latest',
  ]);
});

test('finds nothing in a manifest without dependency fields', (t) => {
  const root = makeManifest(t, '{ "name": "x" }\n');

  assert.deepEqual(getUnpinnedDependencies(root), []);
});

function makeManifest(t: TestContext, text: string): string {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'package.json'), text);

  return root;
}
