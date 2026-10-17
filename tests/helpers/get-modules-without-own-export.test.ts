import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { getModulesWithoutOwnExport } from './get-modules-without-own-export.ts';
import { makeTempDir } from './make-temp-dir.ts';

const NAMED_MODULE = 'get-name.ts';
const MISNAMED_MODULE = 'get-other.ts';

test('passes a module that exports the camelCase of its file name', async (t) => {
  const moduleDir = makeModuleDir(t);

  assert.deepEqual(await getModulesWithoutOwnExport(moduleDir, [NAMED_MODULE]), []);
});

test('lists a module that does not export the camelCase of its file name', async (t) => {
  const moduleDir = makeModuleDir(t);

  assert.deepEqual(
    await getModulesWithoutOwnExport(moduleDir, [NAMED_MODULE, MISNAMED_MODULE]),
    [MISNAMED_MODULE],
  );
});

function makeModuleDir(t: TestContext): string {
  const moduleDir = makeTempDir(t);

  writeFileSync(
    join(moduleDir, NAMED_MODULE),
    'export function getName(): string {\n  return "a";\n}\n',
  );
  writeFileSync(
    join(moduleDir, MISNAMED_MODULE),
    'export function getName(): string {\n  return "b";\n}\n',
  );

  return moduleDir;
}
