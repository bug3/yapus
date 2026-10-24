import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { runGit } from '../../helpers/run-git.ts';
import { getVersionBumpProblems } from './get-version-bump-problems.ts';

const PLUGIN_DIR = join('plugins', 'providens');
const MANIFEST = join(PLUGIN_DIR, '.claude-plugin', 'plugin.json');
const HOOK = join('hooks', 'run.sh');
const STALE = [
  'plugins/providens/.claude-plugin/plugin.json: the shipped files changed since '
  + 'providens-1.0.0 under the same version',
];

test('finds nothing when no version is tagged', (t) => {
  const root = makeShippedRepo(t);

  assert.deepEqual(getVersionBumpProblems(root), []);
});

test('finds nothing when the shipped files match the tagged version', (t) => {
  const root = makeShippedRepo(t);

  tagVersion(root);

  assert.deepEqual(getVersionBumpProblems(root), []);
});

test('names a hook changed under the tagged version', (t) => {
  const root = makeShippedRepo(t);

  tagVersion(root);
  writeFileSync(join(root, HOOK), 'changed\n');

  assert.deepEqual(getVersionBumpProblems(root), STALE);
});

test('finds nothing when the changed plugin carries a new version', (t) => {
  const root = makeShippedRepo(t);

  tagVersion(root);
  writeFileSync(join(root, HOOK), 'changed\n');
  writeManifest(root, '1.0.1');

  assert.deepEqual(getVersionBumpProblems(root), []);
});

test('finds nothing when only an unshipped file changed', (t) => {
  const root = makeShippedRepo(t);

  tagVersion(root);
  writeFileSync(join(root, 'README.md'), 'changed\n');

  assert.deepEqual(getVersionBumpProblems(root), []);
});

// A committed repository with the manifest at 1.0.0, one hook and a README.
function makeShippedRepo(t: TestContext): string {
  const root = makeTempRepo(t);

  mkdirSync(join(root, 'hooks'));
  writeFileSync(join(root, HOOK), 'original\n');
  writeFileSync(join(root, 'README.md'), 'original\n');
  writeManifest(root, '1.0.0');
  runGit(['add', '--all'], root);
  runGit(['commit', '--quiet', '--message', 'chore(project): add the plugin'], root);

  return root;
}

function writeManifest(root: string, version: string): void {
  mkdirSync(join(root, PLUGIN_DIR, '.claude-plugin'), { recursive: true });
  writeFileSync(join(root, MANIFEST), `{ "name": "providens", "version": "${ version }" }\n`);
}

function tagVersion(root: string): void {
  runGit(['tag', 'providens-1.0.0'], root);
}
