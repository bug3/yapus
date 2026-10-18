import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getSetUViolations } from './get-set-u-violations.ts';

const SHEBANG = '#!/usr/bin/env bash\n';

test('finds nothing in a script whose first command is set -u', (t) => {
  const root = makeScript(t, `${ SHEBANG }\n# a comment\nset -u\n\necho hi\n`);

  assert.deepEqual(getSetUViolations(root), []);
});

test('names a script whose first command is not set -u', (t) => {
  const root = makeScript(t, `${ SHEBANG }echo hi\nset -u\n`);

  assert.deepEqual(getSetUViolations(root), ['s.sh: first command is not set -u']);
});

test('names the line that turns set -e on', (t) => {
  const root = makeScript(t, `${ SHEBANG }set -u\nset -eo pipefail\n`);

  assert.deepEqual(getSetUViolations(root), ['s.sh:3: turns set -e on']);
});

test('ignores a file without the bash shebang', (t) => {
  const root = makeScript(t, 'set -e\n');

  assert.deepEqual(getSetUViolations(root), []);
});

function makeScript(t: TestContext, text: string): string {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 's.sh'), text);

  return root;
}
