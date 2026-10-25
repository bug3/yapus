import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTemplates } from '../../../../../hooks/landmark/project/files/read-templates.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const BASE = join(ROOT, 'hooks', 'landmark', 'project', 'files');
// The ShellCheck step of test.yml and the comment above it, 1-based.
const SHELLCHECK_FIRST_LINE = 18;
const SHELLCHECK_LAST_LINE = 22;

function findText(target: string): string | undefined {
  return readTemplates().find((template) => template.target === target)?.text;
}

test('lists exactly the five targets with their kinds', () => {
  assert.deepEqual(
    readTemplates().map(({ target, kind }) => ({ target, kind })),
    [
      { target: '.landmark/eslint.config.ts', kind: 'owned' },
      { target: '.landmark/tsconfig.json', kind: 'owned' },
      { target: '.github/workflows/landmark.yml', kind: 'owned' },
      { target: 'eslint.config.ts', kind: 'wrapper' },
      { target: 'tsconfig.json', kind: 'wrapper' },
    ],
  );
});

test('carries the bytes of the base ESLint config', () => {
  assert.equal(
    findText('.landmark/eslint.config.ts'),
    readFileSync(join(BASE, 'eslint.config.ts'), 'utf8'),
  );
});

test('carries the bytes of the base tsconfig', () => {
  assert.equal(
    findText('.landmark/tsconfig.json'),
    readFileSync(join(BASE, 'tsconfig.json'), 'utf8'),
  );
});

test('makes the workflow equal to test.yml without its ShellCheck step', () => {
  const lines = readFileSync(join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8').split('\n');
  const expected = [
    ...lines.slice(0, SHELLCHECK_FIRST_LINE - 1),
    ...lines.slice(SHELLCHECK_LAST_LINE),
  ].join('\n');

  assert.equal(findText('.github/workflows/landmark.yml'), expected);
});

test('keeps the ShellCheck step out of the workflow', () => {
  assert.doesNotMatch(findText('.github/workflows/landmark.yml') ?? '', /shellcheck/i);
});

test('makes the wrapper tsconfig extend the base and name the build info file', () => {
  const text = findText('tsconfig.json') ?? '';

  assert.deepEqual(JSON.parse(text), {
    extends: './.landmark/tsconfig.json',
    compilerOptions: { tsBuildInfoFile: 'node_modules/.cache/landmark/tsbuildinfo' },
  });
  assert.ok(text.endsWith('}\n'));
});

test('makes the wrapper ESLint config import the base with its extension', () => {
  assert.equal(
    findText('eslint.config.ts'),
    [
      'import { defineConfig } from \'eslint/config\';',
      'import base from \'./.landmark/eslint.config.ts\';',
      '',
      'export default defineConfig(base);',
      '',
    ].join('\n'),
  );
});
