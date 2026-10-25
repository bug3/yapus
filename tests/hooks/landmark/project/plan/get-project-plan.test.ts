import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getProjectPlan,
  type PlanResult,
  type ProjectPlan,
} from '../../../../../hooks/landmark/project/plan/get-project-plan.ts';
import { getScopes } from '../../../../../hooks/landmark/project/plan/get-scopes.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { makeTempRepo } from '../../../../helpers/make-temp-repo.ts';
import { commitFiles, writeFiles } from './commit-files.ts';
import { makeGitEnv } from './make-git-env.ts';
import { templates } from './templates.ts';

function getPlan(planOrRefusals: PlanResult): ProjectPlan {
  assert.ok('plan' in planOrRefusals, 'expected a plan');

  return planOrRefusals.plan;
}

function targetsOf(planOrRefusals: PlanResult): string[] {
  return getPlan(planOrRefusals).writes.map(({ target }) => target);
}

function findWrite(planOrRefusals: PlanResult, target: string): unknown {
  return getPlan(planOrRefusals).writes.find((write) => write.target === target);
}

test('installs every template, the seed and the gitignore into a fresh repository', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
    plan: {
      mode: 'install',
      writes: [
        { target: '.claude/yapus/landmark/eslint.config.ts', text: 'base lint' },
        { target: '.github/workflows/yapus.yml', text: 'workflow' },
        { target: 'eslint.config.ts', text: 'wrapper lint' },
        { target: '.claude/yapus/landmark/scopes.json', text: '[\n  "project"\n]\n' },
        { target: '.gitignore', text: 'node_modules/\n' },
      ],
      removals: [],
      created: [
        '.claude/yapus/landmark/eslint.config.ts',
        '.github/workflows/yapus.yml',
        'eslint.config.ts',
        '.claude/yapus/landmark/scopes.json',
        '.gitignore',
        'package.json',
        '.claude/yapus/landmark/version',
      ],
      changed: [],
    },
  });
});

test('plans an install in a repository with no commits', (t) => {
  const repo = makeTempRepo(t);

  assert.deepEqual(targetsOf(getProjectPlan(repo, templates, makeGitEnv(t))), [
    '.claude/yapus/landmark/eslint.config.ts',
    '.github/workflows/yapus.yml',
    'eslint.config.ts',
    '.claude/yapus/landmark/scopes.json',
    '.gitignore',
  ]);
});

test('upgrades with the owned templates only when the stamp exists', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['eslint.config.js', 'old'],
    ['package.json', '{}'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
    plan: {
      mode: 'upgrade',
      writes: [
        { target: '.claude/yapus/landmark/eslint.config.ts', text: 'base lint' },
        { target: '.github/workflows/yapus.yml', text: 'workflow' },
      ],
      removals: [],
      created: ['.claude/yapus/landmark/eslint.config.ts', '.github/workflows/yapus.yml'],
      changed: ['package.json', '.claude/yapus/landmark/version'],
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

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));
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

  assert.deepEqual(getPlan(planOrRefusals).removals, expected);
  assert.deepEqual(getPlan(planOrRefusals).changed.slice(0, 12), expected);
});

test('does not remove a lint file on an upgrade', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['.eslintrc', 'old'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.deepEqual(getPlan(planOrRefusals).removals, []);
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

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.deepEqual(
    findWrite(planOrRefusals, '.claude/yapus/landmark/scopes.json'),
    {
      target: '.claude/yapus/landmark/scopes.json',
      text: '[\n  "project",\n  "src",\n  "tests"\n]\n',
    },
  );
});

test('does not seed scopes on an upgrade', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/landmark/version', '0.3.0'],
    ['src/a.ts', 'x'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.equal(targetsOf(planOrRefusals).includes('.claude/yapus/landmark/scopes.json'), false);
});

test('keeps an existing scopes file', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/landmark/scopes.json', '["mine"]\n'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.equal(targetsOf(planOrRefusals).includes('.claude/yapus/landmark/scopes.json'), false);
  assert.equal(
    getPlan(planOrRefusals).changed.includes('.claude/yapus/landmark/scopes.json'),
    false,
  );
});

test('adds node_modules to a gitignore that lacks it, after a missing final newline', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'dist'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.deepEqual(
    findWrite(planOrRefusals, '.gitignore'),
    { target: '.gitignore', text: 'dist\nnode_modules/\n' },
  );
});

test('leaves a gitignore that already has a node_modules line', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'dist\n  /node_modules  \n'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.equal(targetsOf(planOrRefusals).includes('.gitignore'), false);
});

test('adds node_modules to a gitignore that only mentions it in a longer line', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'node_modules_old\n'],
  ]);

  const planOrRefusals = getProjectPlan(repo, templates, makeGitEnv(t));

  assert.deepEqual(
    findWrite(planOrRefusals, '.gitignore'),
    { target: '.gitignore', text: 'node_modules_old\nnode_modules/\n' },
  );
});

test('refuses a directory that is not a repository', (t) => {
  const dir = makeTempDir(t);

  assert.deepEqual(getProjectPlan(dir, templates, makeGitEnv(t)), {
    refusals: [`${ dir } is not the root of a git work tree`],
  });
});

test('refuses a subdirectory of a repository', (t) => {
  const repo = makeTempRepo(t);
  const sub = join(repo, 'sub');

  mkdirSync(sub);

  assert.deepEqual(getProjectPlan(sub, templates, makeGitEnv(t)), {
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

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
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

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
    refusals: ['package.json has an uncommitted or untracked change; commit or stash it first'],
  });
});

test('refuses a gitignored file on a touched path', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'eslint.config.ts\n'],
  ]);
  writeFiles(repo, [
    ['eslint.config.ts', 'mine'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
    refusals: [
      'eslint.config.ts has an uncommitted or untracked change; commit or stash it first',
    ],
  });
});

test('refuses a gitignored file inside an ignored directory on a touched path', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', '.claude/yapus/landmark/\n'],
  ]);
  writeFiles(repo, [
    ['.claude/yapus/landmark/version', '0.0.1'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
    refusals: [
      '.claude/yapus/landmark/version has an uncommitted or untracked change; commit or stash it first',
    ],
  });
});

test('does not refuse for an unrelated gitignored file', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.gitignore', 'dist/\n*.log\n'],
  ]);
  writeFiles(repo, [
    ['dist/out.js', 'x'],
    ['debug.log', 'x'],
  ]);

  assert.equal(getPlan(getProjectPlan(repo, templates, makeGitEnv(t))).mode, 'install');
});

test('refuses an uncommitted lint file that install would remove', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.eslintrc', 'old'],
  ]);
  writeFiles(repo, [
    ['.eslintrc', 'edited'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, makeGitEnv(t)), {
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

  assert.equal(getPlan(getProjectPlan(repo, templates, makeGitEnv(t))).mode, 'install');
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
  const planOrRefusals = getProjectPlan(repo, extended, makeGitEnv(t));

  assert.deepEqual(
    [getPlan(planOrRefusals).created, getPlan(planOrRefusals).changed],
    [
      [
        '.claude/yapus/landmark/eslint.config.ts',
        '.github/workflows/yapus.yml',
        '.claude/yapus/landmark/scopes.json',
        '.gitignore',
        '.claude/yapus/landmark/version',
      ],
      ['eslint.config.ts', 'tsconfig.json', 'package.json'],
    ],
  );
});

test('throws when git status fails instead of reading it as no change', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['.claude/yapus/landmark/scopes.json', '[]\n'],
  ]);
  writeFileSync(join(repo, '.git', 'index'), 'not an index');

  assert.throws(() => getProjectPlan(repo, templates, makeGitEnv(t)), /^Error: git status exited \d+$/);
});

test('throws when git ls-files fails instead of seeding only project', (t) => {
  const repo = makeTempRepo(t);

  commitFiles(repo, [
    ['src/a.ts', 'x'],
  ]);
  writeFileSync(join(repo, '.git', 'index'), 'not an index');

  assert.throws(() => getScopes(repo, makeGitEnv(t)), /^Error: git ls-files exited \d+$/);
});

test('runs git with the PATH of the environment it is given', (t) => {
  const repo = makeTempRepo(t);
  const env = { ...makeGitEnv(t), PATH: '/nonexistent' };

  assert.throws(() => getProjectPlan(repo, templates, env), /^Error: git rev-parse .*ENOENT/);
});

test('drops the GIT_ variables of the environment it is given', (t) => {
  const repo = makeTempRepo(t);
  const env = { ...makeGitEnv(t), GIT_DIR: join(makeTempDir(t), 'none') };

  commitFiles(repo, [
    ['README.md', 'x'],
  ]);
  writeFiles(repo, [
    ['eslint.config.ts', 'mine'],
  ]);

  assert.deepEqual(getProjectPlan(repo, templates, env), {
    refusals: [
      'eslint.config.ts has an uncommitted or untracked change; commit or stash it first',
    ],
  });
});
