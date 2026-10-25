import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { getProjectPlan } from '../../../../../hooks/landmark/project/plan/get-project-plan.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { commitFiles, writeFiles } from './commit-files.ts';
import { templates } from './templates.ts';

function targetsOf(result: ReturnType<typeof getProjectPlan>): string[] {
  return 'plan' in result ? result.plan.writes.map(({ target }) => target) : [];
}

function findWrite(result: ReturnType<typeof getProjectPlan>, target: string): unknown {
  return 'plan' in result ? result.plan.writes.find((write) => write.target === target) : result;
}

test('installs every template, the seed and the gitignore into a fresh repository', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates), {
    plan: {
      mode: 'install',
      writes: [
        { target: '.landmark/eslint.config.ts', text: 'base lint' },
        { target: '.github/workflows/landmark.yml', text: 'workflow' },
        { target: 'eslint.config.ts', text: 'wrapper lint' },
        { target: '.landmark/scopes.json', text: '[\n  "project"\n]\n' },
        { target: '.gitignore', text: 'node_modules/\n' },
      ],
      removals: [],
      created: [
        '.landmark/eslint.config.ts',
        '.github/workflows/landmark.yml',
        'eslint.config.ts',
        '.landmark/scopes.json',
        '.gitignore',
        'package.json',
        '.landmark/version',
      ],
      changed: [],
    },
  });
});

test('plans an install in a repository with no commits', (t) => {
  const repo = makeTempRepo(t);

  assert.deepEqual(targetsOf(getProjectPlan(repo, templates)), [
    '.landmark/eslint.config.ts',
    '.github/workflows/landmark.yml',
    'eslint.config.ts',
    '.landmark/scopes.json',
    '.gitignore',
  ]);
});

test('upgrades with the owned templates only when the stamp exists', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.landmark/version', '0.3.0'],
    ['eslint.config.js', 'old'],
    ['package.json', '{}'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates), {
    plan: {
      mode: 'upgrade',
      writes: [
        { target: '.landmark/eslint.config.ts', text: 'base lint' },
        { target: '.github/workflows/landmark.yml', text: 'workflow' },
      ],
      removals: [],
      created: ['.landmark/eslint.config.ts', '.github/workflows/landmark.yml'],
      changed: ['package.json', '.landmark/version'],
    },
  });
});

test('removes every legacy lint file present and lists each as changed', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['eslint.config.js', 'old'],
    ['eslint.config.mjs', 'old'],
    ['eslint.config.cjs', 'old'],
    ['eslint.config.mts', 'old'],
    ['eslint.config.cts', 'old'],
    ['.eslintrc', 'old'],
    ['.eslintrc.js', 'old'],
    ['.eslintrc.cjs', 'old'],
    ['.eslintrc.json', 'old'],
    ['.eslintrc.yaml', 'old'],
    ['.eslintrc.yml', 'old'],
    ['.eslintignore', 'old'],
  ]);

  const result = getProjectPlan(repo, templates);
  const expected = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.mts',
    'eslint.config.cts',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yaml',
    '.eslintrc.yml',
    '.eslintignore',
  ];

  assert.deepEqual('plan' in result ? result.plan.removals : result, expected);
  assert.deepEqual('plan' in result ? result.plan.changed.slice(0, 12) : result, expected);
});

test('does not remove a lint file on an upgrade', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.landmark/version', '0.3.0'],
    ['.eslintrc', 'old'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.deepEqual('plan' in result ? result.plan.removals : result, []);
});

test('seeds scopes from tracked directories, sorted, without .github and __tests__', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['tests/a.ts', 'x'],
    ['src/a.ts', 'x'],
    ['.github/workflows/a.yml', 'x'],
    ['__tests__/a.ts', 'x'],
    ['top.ts', 'x'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.deepEqual(
    findWrite(result, '.landmark/scopes.json'),
    { target: '.landmark/scopes.json', text: '[\n  "project",\n  "src",\n  "tests"\n]\n' },
  );
});

test('does not seed scopes on an upgrade', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.landmark/version', '0.3.0'],
    ['src/a.ts', 'x'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.equal(targetsOf(result).includes('.landmark/scopes.json'), false);
});

test('keeps an existing scopes file', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.landmark/scopes.json', '["mine"]\n'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.equal(targetsOf(result).includes('.landmark/scopes.json'), false);
  assert.equal('plan' in result && result.plan.changed.includes('.landmark/scopes.json'), false);
});

test('adds node_modules to a gitignore that lacks it, after a missing final newline', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'dist'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.deepEqual(
    findWrite(result, '.gitignore'),
    { target: '.gitignore', text: 'dist\nnode_modules/\n' },
  );
});

test('leaves a gitignore that already has a node_modules line', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'dist\n  /node_modules  \n'],
  ]);

  assert.equal(targetsOf(getProjectPlan(repo, templates)).includes('.gitignore'), false);
});

test('adds node_modules to a gitignore that only mentions it in a longer line', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'node_modules_old\n'],
  ]);

  const result = getProjectPlan(repo, templates);

  assert.deepEqual(
    findWrite(result, '.gitignore'),
    { target: '.gitignore', text: 'node_modules_old\nnode_modules/\n' },
  );
});

test('refuses a directory that is not a repository', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(getProjectPlan(dir, templates), {
    refusals: [`${ dir } is not the root of a git work tree`],
  });
});

test('refuses a subdirectory of a repository', (t) => {
  const repo = makeTempRepo(t);
  const sub = join(repo, 'sub');

  mkdirSync(sub);

  assert.deepEqual(getProjectPlan(sub, templates), {
    refusals: [`${ sub } is not the root of a git work tree`],
  });
});

test('refuses an untracked file on a touched path', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);
  writeFiles(repo, [
    ['eslint.config.ts', 'mine'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates), {
    refusals: [
      'eslint.config.ts has an uncommitted or untracked change; commit or stash it first',
    ],
  });
});

test('refuses a modified tracked package.json', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['package.json', '{}'],
  ]);
  writeFiles(repo, [
    ['package.json', '{"name":"x"}'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates), {
    refusals: ['package.json has an uncommitted or untracked change; commit or stash it first'],
  });
});

test('refuses an uncommitted lint file that install would remove', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.eslintrc', 'old'],
  ]);
  writeFiles(repo, [
    ['.eslintrc', 'edited'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates), {
    refusals: ['.eslintrc has an uncommitted or untracked change; commit or stash it first'],
  });
});

test('does not refuse for an unrelated untracked file', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);
  writeFiles(repo, [
    ['notes.txt', 'scratch'],
    ['src/new.ts', 'x'],
  ]);

  assert.equal('plan' in getProjectPlan(repo, templates), true);
});

test('splits created and changed by what exists now', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['tsconfig.json', '{}'],
    ['eslint.config.ts', 'mine'],
    ['package.json', '{}'],
  ]);

  const extended = [
    ...templates,
    { target: 'tsconfig.json', kind: 'wrapper' as const, text: 'wrapper ts' },
  ];
  const result = getProjectPlan(repo, extended);

  assert.deepEqual(
    'plan' in result ? [result.plan.created, result.plan.changed] : result,
    [
      [
        '.landmark/eslint.config.ts',
        '.github/workflows/landmark.yml',
        '.landmark/scopes.json',
        '.gitignore',
        '.landmark/version',
      ],
      ['eslint.config.ts', 'tsconfig.json', 'package.json'],
    ],
  );
});

test('throws when git status fails instead of reading it as no change', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);
  writeFileSync(join(repo, '.git', 'index'), 'not an index');

  assert.throws(() => getProjectPlan(repo, templates), /^Error: git status exited \d+$/);
});
