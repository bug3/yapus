import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { getMessages } from '../../../../hooks/git/subject/get-messages.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const CATALOGS = join(
  import.meta.dirname, '..', '..', '..', '..', 'hooks', 'git', 'subject', 'catalogs',
);

test('returns no message for a valid subject', async (t) => {
  const messagePath = writeMessage(t, 'feat(hooks): add a check\n\nThe body.\n');

  assert.deepEqual(
    await getMessages({ messagePath, isEditorUsed: false, catalogsPath: CATALOGS }),
    [],
  );
});

test('names every unknown part of the subject', async (t) => {
  const messagePath = writeMessage(t, 'feet(hooks): added a check\n');

  assert.deepEqual(
    await getMessages({ messagePath, isEditorUsed: false, catalogsPath: CATALOGS }),
    [
      `yapus subject: type "feet" is not in ${ CATALOGS }/types.json; use a listed one or add it there`,
      `yapus subject: verb "added" is not in ${ CATALOGS }/verbs.json; use a listed one or add it there`,
    ],
  );
});

test('judges the subject left after the comments of an editor message', async (t) => {
  const messagePath = writeMessage(t, '# a comment\nfeat(hooks): add a check\n');

  assert.deepEqual(
    await getMessages({ messagePath, isEditorUsed: true, catalogsPath: CATALOGS }),
    [],
  );
});

test('reports a message whose second line is not blank', async (t) => {
  const messagePath = writeMessage(t, 'feat(hooks): add a check\nThe body.\n');

  assert.deepEqual(
    await getMessages({ messagePath, isEditorUsed: false, catalogsPath: CATALOGS }),
    [
      'yapus subject: the line after the subject is not blank; leave it empty before the body',
    ],
  );
});

test('reports a message file that cannot be read', async (t) => {
  const messagePath = join(makeTempDir(t), 'missing');

  assert.deepEqual(
    await getMessages({ messagePath, isEditorUsed: false, catalogsPath: CATALOGS }),
    [
      `yapus subject: cannot read the message file ${ messagePath }; the commit is blocked, retry it`,
    ],
  );
});

test('reports every catalog that cannot be read', async (t) => {
  const messagePath = writeMessage(t, 'feat(hooks): add a check\n');
  const catalogsPath = makeTempDir(t);

  assert.deepEqual(await getMessages({ messagePath, isEditorUsed: false, catalogsPath }), [
    `yapus subject: ${ catalogsPath }/types.json cannot be read; the commit is blocked until the catalog is fixed`,
    `yapus subject: ${ catalogsPath }/scopes.json cannot be read; the commit is blocked until the catalog is fixed`,
    `yapus subject: ${ catalogsPath }/verbs.json cannot be read; the commit is blocked until the catalog is fixed`,
  ]);
});

function writeMessage(t: TestContext, messageText: string): string {
  const messagePath = join(makeTempDir(t), 'COMMIT_EDITMSG');

  writeFileSync(messagePath, messageText);

  return messagePath;
}
