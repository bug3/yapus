import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { readLabels } from '../../../../hooks/shared/labels/read-labels.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const STYLE = { color: '0e8a16', description: 'Type of change' };
const LABELS = {
  type: STYLE,
  scope: { color: '1d76db', description: 'Area' },
  extras: [{ name: 'kind: bug', color: 'd73a4a', description: 'Broken' }],
};

function catalogsIn(t: TestContext, labels: unknown = LABELS): string {
  const directory = makeTempDir(t);

  writeFileSync(join(directory, 'types.json'), '["feat","fix"]');
  writeFileSync(join(directory, 'scopes.json'), '["hooks"]');
  writeFileSync(join(directory, 'labels.json'), JSON.stringify(labels));

  return directory;
}

test('derives a label per type and per scope, then the extras', async (t) => {
  assert.deepEqual(await readLabels(catalogsIn(t)), [
    { name: 'type: feat', color: '0e8a16', description: 'Type of change' },
    { name: 'type: fix', color: '0e8a16', description: 'Type of change' },
    { name: 'scope: hooks', color: '1d76db', description: 'Area' },
    { name: 'kind: bug', color: 'd73a4a', description: 'Broken' },
  ]);
});

test('reports a types catalog that cannot be read', async (t) => {
  const directory = catalogsIn(t);

  writeFileSync(join(directory, 'types.json'), 'nope');

  assert.deepEqual(await readLabels(directory), {
    violation: `${ directory }/types.json is not JSON; blocked until the catalog is fixed`,
  });
});

test('reports a label catalog that is missing', async (t) => {
  const directory = makeTempDir(t);

  writeFileSync(join(directory, 'types.json'), '["feat"]');
  writeFileSync(join(directory, 'scopes.json'), '["hooks"]');

  assert.deepEqual(await readLabels(directory), {
    violation: `${ directory }/labels.json is missing or not a label catalog; `
      + 'blocked until it is fixed',
  });
});

test('reports a label with a colour that is not six hex digits', async (t) => {
  const bad = { ...LABELS, type: { ...STYLE, color: 'green' } };
  const directory = catalogsIn(t, bad);

  assert.deepEqual(await readLabels(directory), {
    violation: `${ directory }/labels.json is missing or not a label catalog; `
      + 'blocked until it is fixed',
  });
});

test('reports an extra label whose name has a comma', async (t) => {
  const bad = { ...LABELS, extras: [{ name: 'a,b', color: 'd73a4a', description: 'x' }] };
  const directory = catalogsIn(t, bad);

  assert.deepEqual(await readLabels(directory), {
    violation: `${ directory }/labels.json is missing or not a label catalog; `
      + 'blocked until it is fixed',
  });
});

test('reads the catalogs of the repository', async () => {
  const labels = await readLabels(join(import.meta.dirname, '..', '..', '..', '..', 'hooks',
    'shared', 'catalogs'));

  assert.ok(Array.isArray(labels));
  assert.ok(labels.some(({ name }) => name === 'type: feat'));
  assert.ok(labels.some(({ name }) => name === 'breaking-change'));
});
