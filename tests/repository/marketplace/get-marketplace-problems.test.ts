import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getMarketplaceProblems } from './get-marketplace-problems.ts';

const ENTRY = '{ "name": "a", "source": "./plugins/a" }';
const MANIFEST = '{ "name": "a" }';

test('finds nothing when each entry has a matching manifest and no version', (t) => {
  assert.deepEqual(getMarketplaceProblems(makeTree(t, ENTRY, MANIFEST)), []);
});

test('names a missing marketplace', (t) => {
  assert.deepEqual(getMarketplaceProblems(makeTempRepo(t)), [
    '.claude-plugin/marketplace.json: missing, not JSON or without a plugins list',
  ]);
});

test('names a source outside the repository', (t) => {
  const root = makeTree(t, '{ "name": "a", "source": "../a" }', MANIFEST);

  assert.deepEqual(getMarketplaceProblems(root), [
    'a: source is not a ./ path in this repository',
  ]);
});

test('names a missing manifest', (t) => {
  const root = makeTree(t, '{ "name": "a", "source": "./plugins/b" }', MANIFEST);

  assert.deepEqual(getMarketplaceProblems(root), [
    'a: ./plugins/b/.claude-plugin/plugin.json is missing or not JSON',
  ]);
});

test('names a version in either file and a manifest of another name', (t) => {
  const root = makeTree(
    t,
    '{ "name": "a", "source": "./plugins/a", "version": "1.0.0" }',
    '{ "name": "b", "version": "1.0.0" }',
  );

  assert.deepEqual(getMarketplaceProblems(root), [
    'a: the marketplace entry carries a version',
    'a: .claude-plugin/plugin.json carries a version',
    'a: .claude-plugin/plugin.json names another plugin',
  ]);
});

function makeTree(t: TestContext, entry: string, manifest: string): string {
  const root = makeTempRepo(t);
  const plugin = join(root, 'plugins', 'a', '.claude-plugin');

  mkdirSync(join(root, '.claude-plugin'));
  mkdirSync(plugin, { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), `{ "plugins": [${ entry }] }\n`);
  writeFileSync(join(plugin, 'plugin.json'), `${ manifest }\n`);

  return root;
}
