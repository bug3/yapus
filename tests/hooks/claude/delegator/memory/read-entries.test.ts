import assert from 'node:assert/strict';
import { mkdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readEntries } from '../../../../../hooks/claude/delegator/memory/read-entries.ts';
import { makeMemoryProject } from '../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

// The modification time the entry tests give a file, in seconds after the
// epoch.
const MODIFIED_SECONDS = 1_700_000_000;

test('reads a file with a description as an entry with its body and modification time', (t) => {
  const projectRoot = makeMemoryProject(t, [
    {
      path: 'reference/site-dns.md',
      text: '---\ndescription: "The DNS rows"\n---\n\nKeep the row.\n',
    },
  ]);

  utimesSync(
    join(projectRoot, '.yapus/memory/reference/site-dns.md'),
    MODIFIED_SECONDS,
    MODIFIED_SECONDS,
  );

  assert.deepEqual(readEntries(projectRoot), {
    entries: [{
      directory: 'reference',
      name: 'site-dns',
      path: '.yapus/memory/reference/site-dns.md',
      description: 'The DNS rows',
      event: undefined,
      supersededBy: undefined,
      plan: undefined,
      modifiedAt: new Date(MODIFIED_SECONDS * 1000),
      body: '\nKeep the row.\n',
    }],
    problems: [],
  });
});

test('reads the entries of each directory, work then rules then reference, each by name', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'reference/b.md', text: '---\ndescription: "b"\n---\n' },
    { path: 'rules/a.md', text: '---\ndescription: "a"\n---\n' },
    { path: 'rules/a-b.md', text: '---\ndescription: "a-b"\n---\n' },
    { path: 'work/z.md', text: '---\ndescription: "z"\n---\n' },
    { path: 'work/c.md', text: '---\ndescription: "c"\n---\n' },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ directory, name }) => `${ directory }/${ name }`), problems],
    [['work/c', 'work/z', 'rules/a', 'rules/a-b', 'reference/b'], []],
  );
});

test('reads the gh event and the launch event of a rule', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/merge.md', text: '---\ndescription: "d"\nevent: "gh pr merge"\n---\n' },
    {
      path: 'rules/brief.md',
      text: '---\ndescription: "d"\nevent: "launch delegator:finisher"\n---\n',
    },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ event }) => event), problems],
    [
      [
        { kind: 'launch', agentType: 'delegator:finisher' },
        { kind: 'gh', group: 'pr', action: 'merge' },
      ],
      [],
    ],
  );
});

test('reads the successor of a rule that names a file in rules', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/old.md', text: '---\ndescription: "d"\nsuperseded-by: "new"\n---\n' },
    { path: 'rules/new.md', text: '---\ndescription: "d"\n---\n' },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ supersededBy }) => supersededBy), problems],
    [[undefined, 'new'], []],
  );
});

test('reads the plan of a work entry that names a file under the project root', (t) => {
  const projectRoot = makeMemoryProject(t, [
    {
      path: 'work/site.md',
      text: '---\ndescription: "d"\nplan: ".yapus/plans/site/plan.md"\n---\n',
    },
  ]);

  mkdirSync(join(projectRoot, '.yapus/plans/site'), { recursive: true });
  writeFileSync(join(projectRoot, '.yapus/plans/site/plan.md'), '# Plan\n');

  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ plan }) => plan), problems],
    [['.yapus/plans/site/plan.md'], []],
  );
});

test('names a file with no description and reads no entry from it', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/bare.md', text: 'A rule with no frontmatter.\n' },
    { path: 'work/empty.md', text: '---\ndescription: ""\n---\n' },
    { path: 'reference/plain.md', text: '---\ndescription: no quotes\n---\n' },
  ]);

  assert.deepEqual(readEntries(projectRoot), {
    entries: [],
    problems: [
      { path: '.yapus/memory/reference/plain.md', reason: 'no description' },
      { path: '.yapus/memory/rules/bare.md', reason: 'no description' },
      { path: '.yapus/memory/work/empty.md', reason: 'no description' },
    ],
  });
});

test('names an event of neither form and keeps the rule as an entry with no event', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/merge.md', text: '---\ndescription: "d"\nevent: "merge"\n---\n' },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ name, event }) => [name, event]), problems],
    [
      [['merge', undefined]],
      [{
        path: '.yapus/memory/rules/merge.md',
        reason: 'event "merge" is neither gh <group> <action> nor launch <agent type>',
      }],
    ],
  );
});

test('names a successor that is not in rules and keeps it on the entry as written', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/old.md', text: '---\ndescription: "d"\nsuperseded-by: "gone"\n---\n' },
    { path: 'reference/gone.md', text: '---\ndescription: "d"\n---\n' },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ name, supersededBy }) => [name, supersededBy]), problems],
    [
      [['old', 'gone'], ['gone', undefined]],
      [{
        path: '.yapus/memory/rules/old.md',
        reason: 'superseded-by names gone, which is not in rules/',
      }],
    ],
  );
});

test('names a plan that does not exist and keeps it on the entry as written', (t) => {
  const projectRoot = makeMemoryProject(t, [
    {
      path: 'work/site.md',
      text: '---\ndescription: "d"\nplan: ".yapus/plans/site/plan.md"\n---\n',
    },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ name, plan }) => [name, plan]), problems],
    [
      [['site', '.yapus/plans/site/plan.md']],
      [{
        path: '.yapus/memory/work/site.md',
        reason: 'plan .yapus/plans/site/plan.md does not exist',
      }],
    ],
  );
});

test('names a plan that is empty, a directory or a path through a file', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'work/a.md', text: '---\ndescription: "d"\nplan: ""\n---\n' },
    { path: 'work/b.md', text: '---\ndescription: "d"\nplan: ".yapus/plans/site"\n---\n' },
    { path: 'work/c.md', text: '---\ndescription: "d"\nplan: "notes.md/plan.md"\n---\n' },
  ]);

  mkdirSync(join(projectRoot, '.yapus/plans/site'), { recursive: true });
  writeFileSync(join(projectRoot, 'notes.md'), 'a file\n');

  assert.deepEqual(readEntries(projectRoot).problems, [
    { path: '.yapus/memory/work/a.md', reason: 'plan  does not exist' },
    { path: '.yapus/memory/work/b.md', reason: 'plan .yapus/plans/site does not exist' },
    { path: '.yapus/memory/work/c.md', reason: 'plan notes.md/plan.md does not exist' },
  ]);
});

test('names every problem of one file, the description first', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/both.md', text: '---\nevent: "merge"\nsuperseded-by: "gone"\n---\n' },
  ]);

  assert.deepEqual(readEntries(projectRoot), {
    entries: [],
    problems: [
      { path: '.yapus/memory/rules/both.md', reason: 'no description' },
      {
        path: '.yapus/memory/rules/both.md',
        reason: 'event "merge" is neither gh <group> <action> nor launch <agent type>',
      },
      {
        path: '.yapus/memory/rules/both.md',
        reason: 'superseded-by names gone, which is not in rules/',
      },
    ],
  });
});

test('names a file directly in the memory directory, a level deeper or beside the three', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'loose.md', text: '---\ndescription: "d"\n---\n' },
    { path: 'rules/deeper/nested.md', text: '---\ndescription: "d"\n---\n' },
    { path: 'lessons/learned.md', text: '---\ndescription: "d"\n---\n' },
  ]);

  assert.deepEqual(readEntries(projectRoot), {
    entries: [],
    problems: [
      {
        path: '.yapus/memory/lessons/learned.md',
        reason: 'outside work/, rules/ and reference/',
      },
      { path: '.yapus/memory/loose.md', reason: 'outside work/, rules/ and reference/' },
      {
        path: '.yapus/memory/rules/deeper/nested.md',
        reason: 'outside work/, rules/ and reference/',
      },
    ],
  });
});

test('reads an event and a successor under rules alone and a plan under work alone', (t) => {
  const projectRoot = makeMemoryProject(t, [
    {
      path: 'work/item.md',
      text: '---\ndescription: "d"\nevent: "merge"\nsuperseded-by: "x"\n---\n',
    },
    { path: 'rules/rule.md', text: '---\ndescription: "d"\nplan: "nowhere/plan.md"\n---\n' },
    { path: 'reference/note.md', text: '---\ndescription: "d"\nevent: "gh pr merge"\n---\n' },
  ]);
  const { entries, problems } = readEntries(projectRoot);

  assert.deepEqual(
    [entries.map(({ event, supersededBy, plan }) => [event, supersededBy, plan]), problems],
    [
      [
        [undefined, undefined, undefined],
        [undefined, undefined, undefined],
        [undefined, undefined, undefined],
      ],
      [],
    ],
  );
});

test('reads no moves file, no file of another ending and no dot name at any depth', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'migration.json', text: '{}\n' },
    { path: '.gitignore', text: '*\n' },
    { path: '.hidden.md', text: 'no frontmatter\n' },
    { path: 'rules/.draft.md', text: 'no frontmatter\n' },
    { path: 'rules/notes.txt', text: 'no frontmatter\n' },
    { path: '.archive/old.md', text: 'no frontmatter\n' },
    { path: 'work/.kept/old.md', text: 'no frontmatter\n' },
  ]);

  assert.deepEqual(readEntries(projectRoot), { entries: [], problems: [] });
});

test('reads no link and no directory named as a memory file', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/folder.md/notes.txt', text: 'no frontmatter\n' },
  ]);
  const outside = join(makeTempDir(t), 'outside.md');

  writeFileSync(outside, 'no frontmatter\n');
  symlinkSync(outside, join(projectRoot, '.yapus/memory/rules/linked.md'));

  assert.deepEqual(readEntries(projectRoot), { entries: [], problems: [] });
});

test('reads no entry and no problem where a file stands in the place of rules', (t) => {
  const projectRoot = makeMemoryProject(t, [{ path: 'rules', text: 'a file\n' }]);

  assert.deepEqual(readEntries(projectRoot), { entries: [], problems: [] });
});

test('reads no entry and no problem where a file stands in the place of the directory', (t) => {
  const projectRoot = makeTempDir(t);

  mkdirSync(join(projectRoot, '.yapus'));
  writeFileSync(join(projectRoot, '.yapus', 'memory'), 'a file\n');

  assert.deepEqual(readEntries(projectRoot), { entries: [], problems: [] });
});

test('reads no entry and no problem in an empty memory directory or without one', (t) => {
  assert.deepEqual(
    [readEntries(makeMemoryProject(t, [])), readEntries(makeTempDir(t))],
    [{ entries: [], problems: [] }, { entries: [], problems: [] }],
  );
});
