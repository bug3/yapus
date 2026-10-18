import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import {
  getAlwaysLoaded,
  getAlwaysLoadedRules,
  getDuplicateRuleIds,
  getImportedPathsFiles,
} from './get-always-loaded.ts';

interface File {
  readonly path: string;
  readonly text: string;
}

const PATHS_HEAD = '---\npaths:\n  - "**/*.ts"\n---\n\n';

test('lists the rules of CLAUDE.md and its imports in load order', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '@standards/A.md\n' },
    { path: 'standards/A.md', text: '# A\n\n## A-1. x\n\n## A-2. y\n\n@B.md\n' },
    { path: 'standards/B.md', text: '# B\n\n## B-1. z\n' },
  ]);

  assert.deepEqual(getAlwaysLoadedRules(root), ['A-1', 'A-2', 'B-1']);
});

test('follows an import four hops and not five', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '@h1.md\n' },
    makeHop('1', '2'),
    makeHop('2', '3'),
    makeHop('3', '4'),
    makeHop('4', '5'),
    makeHop('5', '6'),
    { path: 'h6.md', text: '## H-6. x\n' },
  ]);

  assert.deepEqual(getAlwaysLoadedRules(root), ['H-1', 'H-2', 'H-3', 'H-4']);
});

test('follows no import inside a code span, a fenced block or an HTML comment', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: 'see `@a.md`\n\n```\n@b.md\n```\n\n<!-- @c.md -->\n' },
    { path: 'a.md', text: '## A-1. x\n' },
    { path: 'b.md', text: '## B-1. x\n' },
    { path: 'c.md', text: '## C-1. x\n' },
  ]);

  assert.deepEqual(getAlwaysLoadedRules(root), []);
});

test('names an import whose target is not on disk', (t) => {
  const root = makeTree(t, [{ path: 'CLAUDE.md', text: '@standards/GONE.md\n' }]);

  assert.deepEqual(getAlwaysLoaded(root).missing, ['CLAUDE.md imports standards/GONE.md']);
});

test('counts a rule file with no paths head and not one with a head', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '' },
    { path: '.claude/rules/always.md', text: '## X-1. x\n' },
    { path: '.claude/rules/scoped.md', text: `${ PATHS_HEAD }## Y-1. y\n` },
  ]);

  assert.deepEqual(getAlwaysLoadedRules(root), ['X-1']);
});

test('counts the injected policy after the loaded files', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '## A-1. x\n' },
    { path: 'hooks/claude/providens/policy/policy.md', text: '## ORCH-1. y\n' },
  ]);

  assert.deepEqual(getAlwaysLoadedRules(root), ['A-1', 'ORCH-1']);
});

test('names an imported file that carries a paths head', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '@standards/A.md\n' },
    { path: 'standards/A.md', text: `${ PATHS_HEAD }## A-1. x\n` },
  ]);

  assert.deepEqual(getImportedPathsFiles(root), ['standards/A.md']);
});

test('names a rule id that two files hold', (t) => {
  const root = makeTree(t, [
    { path: 'CLAUDE.md', text: '@standards/A.md\n' },
    { path: 'standards/A.md', text: '## A-1. x\n' },
    { path: 'standards/B.md', text: `${ PATHS_HEAD }## A-1. y\n\n## B-1. z\n` },
  ]);

  assert.deepEqual(getDuplicateRuleIds(root), ['A-1']);
});

test('finds nothing to load without a CLAUDE.md', (t) => {
  const root = makeTree(t, []);

  assert.deepEqual(getAlwaysLoaded(root), { files: [], missing: [] });
});

function makeHop(from: string, to: string): File {
  return { path: `h${ from }.md`, text: `## H-${ from }. x\n\n@h${ to }.md\n` };
}

function makeTree(t: TestContext, files: readonly File[]): string {
  const root = makeTempRepo(t);

  for (const { path, text } of files) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }

  return root;
}
