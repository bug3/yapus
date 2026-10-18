import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getToolViolation } from '../../../../hooks/git/push/get-tool-violation.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const LIMIT_SECONDS = 10;
const GIT_2_16 = "#!/bin/sh\necho 'git version 2.16.9'\n";
const GIT_2_17 = "#!/bin/sh\necho 'git version 2.17.0'\n";
const GIT_3 = "#!/bin/sh\necho 'git version 3.0.0'\n";
const NPM = '#!/bin/sh\nexit 0\n';

test('passes git 2.17 beside npm', (t) => {
  const toolDir = makeTempDir(t);

  writeTool(toolDir, 'git', GIT_2_17);
  writeTool(toolDir, 'npm', NPM);

  assert.equal(getToolViolation({ PATH: toolDir }, LIMIT_SECONDS), undefined);
});

test('refuses git older than 2.17', (t) => {
  const toolDir = makeTempDir(t);

  writeTool(toolDir, 'git', GIT_2_16);
  writeTool(toolDir, 'npm', NPM);

  assert.equal(
    getToolViolation({ PATH: toolDir }, LIMIT_SECONDS),
    'git is older than 2.17; install git 2.17 or newer',
  );
});

test('refuses a missing git', (t) => {
  const toolDir = makeTempDir(t);

  writeTool(toolDir, 'npm', NPM);

  assert.equal(
    getToolViolation({ PATH: toolDir }, LIMIT_SECONDS),
    'git not found; install git 2.17 or newer',
  );
});

test('refuses a missing npm', (t) => {
  const toolDir = makeTempDir(t);

  writeTool(toolDir, 'git', GIT_3);

  assert.equal(
    getToolViolation({ PATH: toolDir }, LIMIT_SECONDS),
    'npm not found; install Node 24 or newer with npm',
  );
});

// A stand-in for a tool on PATH: an executable shell script.
function writeTool(toolDir: string, name: string, script: string): void {
  writeFileSync(join(toolDir, name), script, { mode: 0o755 });
}
