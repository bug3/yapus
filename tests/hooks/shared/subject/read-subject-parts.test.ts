import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readSubjectParts,
} from '../../../../hooks/shared/subject/read-subject-parts.ts';

test('reads the type, scope and verb of a subject', () => {
  assert.deepEqual(readSubjectParts('feat(hooks): add a check'), {
    type: 'feat',
    scope: 'hooks',
    verb: 'add',
    isBreaking: false,
  });
});

test('reads a bang before the colon as a breaking change', () => {
  assert.deepEqual(readSubjectParts('fix(git-gate)!: stop it'), {
    type: 'fix',
    scope: 'git-gate',
    verb: 'stop',
    isBreaking: true,
  });
});

test('reads nothing from a subject out of form', () => {
  assert.equal(readSubjectParts('Add a check'), undefined);
});
