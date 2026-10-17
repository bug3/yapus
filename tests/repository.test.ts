import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';
import { getMarkdownDashLocations } from './helpers/get-markdown-dash-locations.ts';
import { getModulesWithoutOwnExport } from './helpers/get-modules-without-own-export.ts';
import { isCanonicalJson } from './helpers/is-canonical-json.ts';
import { isKebabCase } from './helpers/is-kebab-case.ts';
import { listFiles, listModules } from './helpers/list-files.ts';

const ROOT = join(import.meta.dirname, '..');

test('names every TypeScript file in kebab-case', () => {
  const fileNames = listFiles(ROOT, '.ts').map((path) => basename(path, '.ts'));

  assert.deepEqual(fileNames.filter((fileName) => !isKebabCase(fileName)), []);
});

test('exports from every module the camelCase of its file name', async () => {
  assert.deepEqual(await getModulesWithoutOwnExport(ROOT, listModules(ROOT)), []);
});

test('writes every JSON file in the D2 form', () => {
  const jsonPaths = listFiles(ROOT, '.json');

  assert.deepEqual(
    jsonPaths.filter((path) => !isCanonicalJson(readFileSync(join(ROOT, path), 'utf8'))),
    [],
  );
});

test('writes only the ASCII hyphen in every markdown file', () => {
  assert.deepEqual(getMarkdownDashLocations(ROOT), []);
});
