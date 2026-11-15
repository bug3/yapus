import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readTemplates } from '../../../../../hooks/landmark/repo/files/read-templates.ts';
import {
  getGolangciLintVersion,
} from '../../../../../hooks/landmark/repo/files/go/get-golangci-lint-version.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const BASE = join(ROOT, 'hooks', 'landmark', 'repo', 'files', 'typescript');
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
      { target: '.claude/yapus/landmark/eslint.config.ts', kind: 'owned' },
      { target: '.claude/yapus/landmark/tsconfig.json', kind: 'owned' },
      { target: '.github/workflows/yapus.yml', kind: 'owned' },
      { target: 'eslint.config.ts', kind: 'wrapper' },
      { target: 'tsconfig.json', kind: 'wrapper' },
    ],
  );
});

test('carries the bytes of the base ESLint config', () => {
  assert.equal(
    findText('.claude/yapus/landmark/eslint.config.ts'),
    readFileSync(join(BASE, 'eslint.config.ts'), 'utf8'),
  );
});

test('carries the bytes of the base tsconfig', () => {
  assert.equal(
    findText('.claude/yapus/landmark/tsconfig.json'),
    readFileSync(join(BASE, 'tsconfig.json'), 'utf8'),
  );
});

test('makes the workflow equal to test.yml without its ShellCheck step', () => {
  const lines = readFileSync(join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8').split('\n');
  const expected = [
    ...lines.slice(0, SHELLCHECK_FIRST_LINE - 1),
    ...lines.slice(SHELLCHECK_LAST_LINE),
  ].join('\n');

  assert.equal(findText('.github/workflows/yapus.yml'), expected);
});

test('keeps the ShellCheck step out of the workflow', () => {
  assert.doesNotMatch(findText('.github/workflows/yapus.yml') ?? '', /shellcheck/i);
});

test('makes the wrapper tsconfig extend the base and name the build info file', () => {
  const text = findText('tsconfig.json') ?? '';

  assert.deepEqual(JSON.parse(text), {
    extends: './.claude/yapus/landmark/tsconfig.json',
    compilerOptions: { tsBuildInfoFile: 'node_modules/.cache/yapus/landmark/tsbuildinfo' },
  });
  assert.ok(text.endsWith('}\n'));
});

test('makes the wrapper ESLint config import the base with its extension', () => {
  assert.equal(
    findText('eslint.config.ts'),
    [
      'import { defineConfig } from \'eslint/config\';',
      'import base from \'./.claude/yapus/landmark/eslint.config.ts\';',
      '',
      'export default defineConfig(base);',
      '',
    ].join('\n'),
  );
});

function findGoText(target: string): string {
  return readTemplates('go').find((template) => template.target === target)?.text ?? '';
}

test('lists exactly the two Go targets with their kinds', () => {
  assert.deepEqual(
    readTemplates('go').map(({ target, kind }) => ({ target, kind })),
    [
      { target: '.golangci.yml', kind: 'owned' },
      { target: '.github/workflows/yapus.yml', kind: 'owned' },
    ],
  );
});

test('lists the TypeScript targets when no language is given', () => {
  assert.deepEqual(readTemplates(), readTemplates('typescript'));
});

test('pins every Go workflow action to a commit SHA with a version comment', () => {
  const uses = findGoText('.github/workflows/yapus.yml')
    .split('\n')
    .filter((line) => line.includes('uses:'));

  assert.equal(uses.length, 3);
  assert.equal(uses.filter((line) => /uses: "[^"@]+@[0-9a-f]{40}" # v\d+\.\d+\.\d+$/.test(line)).length, 3);
});

test('limits the Go workflow token to read access on contents', () => {
  assert.match(findGoText('.github/workflows/yapus.yml'), /^permissions:\n {2}contents: "read"\n/m);
});

test('triggers the Go workflow on pull_request only', () => {
  const text = findGoText('.github/workflows/yapus.yml');

  assert.match(text, /^on:\n {2}pull_request:\n\n/m);
  assert.doesNotMatch(text, /pull_request_target|workflow_run/);
});

test('gives the Go workflow job a timeout', () => {
  assert.match(findGoText('.github/workflows/yapus.yml'), /^ {4}timeout-minutes: \d+$/m);
});

test('installs the exported golangci-lint version in the Go workflow', () => {
  assert.match(
    findGoText('.github/workflows/yapus.yml'),
    new RegExp(`^ {10}version: "${ getGolangciLintVersion() }"$`, 'm'),
  );
});

test('writes the approved golangci config for go', () => {
  assert.equal(findGoText('.golangci.yml'), `${ [
    'version: "2"',
    'linters:',
    '  default: "standard"',
    '  enable:',
    '    - "depguard"',
    '    - "errorlint"',
    '    - "exhaustive"',
    '    - "forbidigo"',
    '    - "gocritic"',
    '    - "noctx"',
    '    - "testpackage"',
    '    - "wsl_v5"',
    '  settings:',
    '    depguard:',
    '      rules:',
    '        main:',
    '          deny:',
    '            - pkg: "github.com/stretchr/testify"',
    '              desc: "TEST-7: write tests with the testing package"',
    '    errorlint:',
    '      errorf: true',
    '      asserts: false',
    '      comparison: false',
    '    exhaustive:',
    '      default-signifies-exhaustive: false',
    '    forbidigo:',
    '      forbid:',
    '        - pattern: "^log\\\\.Fatal"',
    '          msg: "CODE-4: log.Fatal exits 1; return the error to main"',
    '    gocritic:',
    '      disable-all: true',
    '      enabled-checks:',
    '        - "ifElseChain"',
    'formatters:',
    '  enable:',
    '    - "gofumpt"',
    '    - "goimports"',
    '    - "golines"',
    '  settings:',
    '    golines:',
    '      max-len: 99',
    'issues:',
    '  max-issues-per-linter: 0',
    '  max-same-issues: 0',
  ].join('\n') }\n`);
});
