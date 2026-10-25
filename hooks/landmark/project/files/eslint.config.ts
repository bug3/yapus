import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';

// Statements that take a blank line before them.
const PADDED_STATEMENTS = ['block-like', 'export', 'function', 'return', 'throw'] as const;

const BARE_BUILTINS: readonly string[] = builtinModules.filter(
  (name) => !name.startsWith('node:') && !name.startsWith('_'),
);

// A line that holds one string literal and nothing else may pass the width.
const LONE_STRING_LINE = '^\\s*([\'"`])(?:\\\\.|(?!\\1).)*\\1[,;)\\]]*$';

const DECLARED_FUNCTION_EXPRESSION =
  'VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression)';

const BARE_BUILTIN_PATTERN = `/^(?:${ BARE_BUILTINS.join('|').replaceAll('/', '\\/') })$/`;

const NO_NULL = {
  selector: 'Literal[raw="null"]:not(BinaryExpression > Literal)',
  message: 'Use undefined for absence.',
} as const;

// Exported so a wrapper config can restrict number parsing alone.
export const NUMBER_PARSING = [
  { object: 'Number', property: 'parseInt', message: 'Convert with Number().' },
  { object: 'Number', property: 'parseFloat', message: 'Convert with Number().' },
] as const;

// Only an entry file ends the process; every other module returns.
const PROCESS_EXIT = {
  object: 'process',
  property: 'exit',
  message: 'End the process only from the entry file.',
} as const;

const RESTRICTED_SYNTAX = [
  {
    selector: `Program > ${ DECLARED_FUNCTION_EXPRESSION }`,
    message: 'Write a module-level function as a function declaration.',
  },
  {
    selector: `Program > ExportNamedDeclaration > ${ DECLARED_FUNCTION_EXPRESSION }`,
    message: 'Write a module-level function as a function declaration.',
  },
  {
    selector: 'CallExpression[callee.property.name="then"]',
    message: 'Use async and await.',
  },
  {
    selector: 'CallExpression[callee.property.name="toString"][arguments.length=0]',
    message: 'Convert with String().',
  },
  {
    selector: `ImportExpression[source.value=${ BARE_BUILTIN_PATTERN }]`,
    message: 'Import a built-in module by its node: name.',
  },
  NO_NULL,
] as const;

export default defineConfig(
  js.configs.recommended,
  globalIgnores(['**/*.{js,mjs,cjs}']),
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
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/max-params': ['error', { max: 3 }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'variable',
          modifiers: ['const', 'global'],
          types: ['number', 'string'],
          format: ['UPPER_CASE'],
        },
        {
          selector: ['variable', 'parameter'],
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should'],
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        // Keys an outside API names keep its spelling, whatever the case style.
        {
          selector: 'objectLiteralProperty',
          format: ['camelCase', 'snake_case', 'PascalCase', 'UPPER_CASE'],
        },
        { selector: 'typeProperty', format: null, modifiers: ['requiresQuotes'] },
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            { from: 'package', name: ['test', 'it', 'describe'], package: 'node:test' },
          ],
        },
      ],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'all' }],
      '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
      '@typescript-eslint/prefer-destructuring': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableObject: false, allowNumber: false, allowString: false },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-cond-assign': ['error', 'always'],
      'no-console': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-eval': 'error',
      'no-implicit-coercion': 'error',
      'no-multi-assign': 'error',
      'no-nested-ternary': 'error',
      'no-object-constructor': 'error',
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            defaultFrom: true,
            direct: true,
            named: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
      'no-restricted-globals': ['error', 'parseInt', 'parseFloat'],
      'no-restricted-properties': ['error', ...NUMBER_PARSING, PROCESS_EXIT],
      'no-restricted-imports': [
        'error',
        {
          paths: BARE_BUILTINS.map((name) => ({
            name,
            message: `Import node:${ name } instead.`,
          })),
        },
      ],
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX],
      'no-underscore-dangle': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-return': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'one-var': ['error', 'never'],
      'prefer-arrow-callback': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-template': 'error',
    },
  },
  // ESLint's API names its keys, demands a default export and takes null to
  // switch a format check off.
  {
    files: ['**/*eslint.config.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      'no-restricted-exports': 'off',
      'no-restricted-syntax': [
        'error',
        ...RESTRICTED_SYNTAX.filter((restriction) => restriction !== NO_NULL),
      ],
    },
  },
);
