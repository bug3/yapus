import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Statements that take a blank line before them.
const PADDED_STATEMENTS = ['block-like', 'export', 'function', 'return', 'throw'] as const;

// A line that holds one string literal and nothing else may pass the width.
const LONE_STRING_LINE = '^\\s*([\'"`])(?:\\\\.|(?!\\1).)*\\1[,;)\\]]*$';

export default defineConfig(
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/arrow-spacing': 'error',
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/comma-spacing': 'error',
      '@stylistic/eol-last': 'error',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/key-spacing': 'error',
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/max-len': [
        'error',
        {
          code: 99,
          ignorePattern: LONE_STRING_LINE,
          ignoreRegExpLiterals: true,
          ignoreUrls: true,
        },
      ],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/padded-blocks': ['error', 'never'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: '*', next: PADDED_STATEMENTS },
        { blankLine: 'always', prev: ['block-like', 'export', 'function'], next: '*' },
        { blankLine: 'always', prev: ['const', 'let'], next: '*' },
        { blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
      ],
      '@stylistic/quote-props': ['error', 'consistent-as-needed'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', asyncArrow: 'always', named: 'never' },
      ],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/template-curly-spacing': ['error', 'always'],
      '@stylistic/type-annotation-spacing': 'error',
      'curly': ['error', 'all'],
    },
  },
);
