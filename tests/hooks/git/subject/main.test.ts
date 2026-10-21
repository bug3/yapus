import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const MAIN = join(ROOT, 'hooks', 'git', 'subject', 'main.ts');
const SUBPROCESS_TIMEOUT_MS = 10000;
const FORM_REFUSAL =
  'is not in the form "type(scope): verb ...", such as "feat(hooks): add a check"; rewrite the subject';
const UNKNOWN_SCOPE_LINE =
  'yapus subject: scope "nope" is not in hooks/shared/catalogs/scopes.json; use a listed one or add it there';
const UNKNOWN_VERB_LINE =
  'yapus subject: verb "added" is not in hooks/shared/catalogs/verbs.json; use a listed one or add it there';

test('exits 0 with no output for a valid message', (t) => {
  const hookRun = runHook(writeMessage(t, 'feat(hooks): add a check\n'));

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 and names the catalog of every unknown part', (t) => {
  const hookRun = runHook(writeMessage(t, 'feat(nope): added a check\n'));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr],
    [2, '', `${ UNKNOWN_SCOPE_LINE }\n${ UNKNOWN_VERB_LINE }\n`],
  );
});

test('judges a # line as the subject when no editor was used', (t) => {
  const hookRun = runHook(writeMessage(t, '# feat(hooks): add a check\n'));

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [2, `yapus subject: "# feat(hooks): add a check" ${ FORM_REFUSAL }\n`],
  );
});

test('exits 2 with one line for a missing message file', (t) => {
  const messagePath = join(makeTempDir(t), 'missing');

  const hookRun = runHook(messagePath);

  assert.deepEqual(
    [hookRun.status, hookRun.stderr],
    [
      2,
      `yapus subject: cannot read the message file ${ messagePath }; the commit is blocked, retry it\n`,
    ],
  );
});

function writeMessage(t: TestContext, messageText: string): string {
  const messagePath = join(makeTempDir(t), 'COMMIT_EDITMSG');

  writeFileSync(messagePath, messageText);

  return messagePath;
}

// GIT_EDITOR=":" is what git sets for a commit made without an editor.
function runHook(messagePath: string) {
  const tempDir = dirname(messagePath);

  return spawnSync(process.execPath, [MAIN, messagePath], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { GIT_EDITOR: ':', HOME: tempDir, TMPDIR: tempDir },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}
