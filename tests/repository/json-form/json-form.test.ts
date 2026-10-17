import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { listFiles } from '../../helpers/list-files.ts';
import { isCanonicalJson } from './is-canonical-json.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

test('writes every JSON file in the D2 form', () => {
  const jsonPaths = listFiles(ROOT, '.json');

  assert.deepEqual(
    jsonPaths.filter((path) => !isCanonicalJson(readFileSync(join(ROOT, path), 'utf8'))),
    [],
  );
});
