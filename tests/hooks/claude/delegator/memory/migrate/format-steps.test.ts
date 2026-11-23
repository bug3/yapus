import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatBackup,
  formatCreated,
  formatDone,
  formatGuide,
  formatStep,
  formatSteps,
} from '../../../../../../hooks/claude/delegator/memory/migrate/format-steps.ts';

const TEXTS = {
  created: 'created <mem path>.',
  guide: 'no file at <moves path>; write <moves path>.',
  listed: 'listed',
  done: 'done; delete <backup> later',
} as const;

test('prints a move as its file and its target and a removal as its file', () => {
  assert.deepEqual(
    [
      formatStep({ kind: 'move', file: 'a.md', directory: 'rules', name: 'a-rule' }),
      formatStep({ kind: 'remove', file: 'b.md' }),
    ],
    ['a.md -> rules/a-rule.md', 'b.md removed'],
  );
});

test('lists the steps in their order, then the kept files', () => {
  const lines = formatSteps({
    autoDirectory: '/c/projects/s/memory',
    steps: [
      { kind: 'remove', file: 'b.md' },
      { kind: 'move', file: 'a.md', directory: 'work', name: 'a' },
    ],
    made: [],
    kept: ['c.md', 'd.md'],
  });

  assert.deepEqual(lines, ['b.md removed', 'a.md -> work/a.md', 'c.md kept', 'd.md kept']);
});

test('lists the steps a run before made first, each as its line and already made', () => {
  const lines = formatSteps({
    autoDirectory: '/c/projects/s/memory',
    steps: [{ kind: 'remove', file: 'b.md' }],
    made: [
      { kind: 'move', file: 'a.md', directory: 'rules', name: 'a-rule' },
      { kind: 'remove', file: 'e.md' },
    ],
    kept: ['c.md'],
  });

  assert.deepEqual(lines, [
    'a.md -> rules/a-rule.md, already made',
    'e.md removed, already made',
    'b.md removed',
    'c.md kept',
  ]);
});

test('lists nothing for no step and no kept file', () => {
  const lines = formatSteps({
    autoDirectory: '/c/projects/s/memory',
    steps: [],
    made: [],
    kept: [],
  });

  assert.deepEqual(lines, []);
});

test('prints the backup as the auto memory directory and the directory it is copied to', () => {
  assert.equal(
    formatBackup('/c/projects/s/memory', '/c/projects/s/memory-backup/x'),
    'backup: /c/projects/s/memory -> /c/projects/s/memory-backup/x',
  );
});

test('fills the memory path of the created line', () => {
  assert.equal(formatCreated(TEXTS, '/p/.yapus/memory'), 'created /p/.yapus/memory.');
});

test('fills both moves paths of the guide and puts the sorting under it', () => {
  assert.equal(
    formatGuide(TEXTS, '/p/m.json', 'the order\nline 1'),
    'no file at /p/m.json; write /p/m.json.\nthe order\nline 1',
  );
});

test('fills the backup of the done line', () => {
  assert.equal(formatDone(TEXTS, '/c/backup/x'), 'done; delete /c/backup/x later');
});

test('keeps a dollar sign of a path as it is', () => {
  assert.deepEqual(
    [
      formatCreated(TEXTS, '/p$&/memory'),
      formatGuide(TEXTS, '/p$&/m.json', ''),
      formatDone(TEXTS, '/c$&/x'),
    ],
    [
      'created /p$&/memory.',
      'no file at /p$&/m.json; write /p$&/m.json.\n',
      'done; delete /c$&/x later',
    ],
  );
});
