import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergePackage } from '../../../../../hooks/ordo/repo/package/merge-package.ts';

const CHECK = 'tsc -p . && eslint --max-warnings 0 --flag unstable_native_nodejs_ts_config .';
const YAPUS_TEST =
  'npm run check && NODE_COMPILE_CACHE="$PWD/node_modules/.cache/yapus/landmark/node" '
  + 'node --test \'tests/**/*.test.ts\'';
const OWNED_KEYS: readonly string[] = [
  'scripts.check',
  'devDependencies.@eslint/js',
  'devDependencies.@stylistic/eslint-plugin',
  'devDependencies.@types/node',
  'devDependencies.eslint',
  'devDependencies.typescript',
  'devDependencies.typescript-eslint',
  'engines.node',
  'type',
];

test('builds a private package with the owned keys when there is no package.json', () => {
  const merge = mergePackage(undefined, 'install');

  assert.equal(merge.text, `{
  "private": true,
  "scripts": {
    "check": "${ CHECK }",
    "test": ${ JSON.stringify(YAPUS_TEST) }
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@stylistic/eslint-plugin": "5.10.0",
    "@types/node": "24.19.2",
    "eslint": "10.13.0",
    "typescript": "6.0.3",
    "typescript-eslint": "8.71.2"
  },
  "engines": {
    "node": ">=24"
  },
  "type": "module"
}
`);
  assert.deepEqual(merge.set, [...OWNED_KEYS, 'scripts.test']);
  assert.deepEqual(merge.removed, []);
});

test('sets the type to module when the project has none', () => {
  const merge = mergePackage('{"name": "app"}', 'install');

  assert.partialDeepStrictEqual(JSON.parse(merge.text), { name: 'app', type: 'module' });
  assert.ok(merge.set.includes('type'));
});

test('sets the type to module when the project is commonjs', () => {
  const merge = mergePackage('{"type": "commonjs"}', 'install');

  assert.partialDeepStrictEqual(JSON.parse(merge.text), { type: 'module' });
  assert.ok(merge.set.includes('type'));
});

test('keeps the existing key order and appends the new keys', () => {
  const merge = mergePackage('{"version": "1.0.0", "name": "app"}', 'upgrade');

  assert.deepEqual(
    merge.text.match(/^ {2}"[^"]+"/gm),
    ['  "version"', '  "name"', '  "scripts"', '  "devDependencies"', '  "engines"', '  "type"'],
  );
});

test('runs an old test after the check', () => {
  const merge = mergePackage('{"scripts": {"test": "jest"}}', 'install');

  assert.partialDeepStrictEqual(
    JSON.parse(merge.text),
    { scripts: { test: 'npm run check && jest' } },
  );
  assert.ok(merge.set.includes('scripts.test'));
});

test('replaces the npm init default test with the node test run', () => {
  const merge = mergePackage(
    '{"scripts": {"test": "echo \\"Error: no test specified\\" && exit 1"}}',
    'install',
  );

  assert.partialDeepStrictEqual(JSON.parse(merge.text), { scripts: { test: YAPUS_TEST } });
});

test('keeps a test that already starts with the check', () => {
  const merge = mergePackage('{"scripts": {"test": "npm run check && jest"}}', 'install');

  assert.partialDeepStrictEqual(
    JSON.parse(merge.text),
    { scripts: { test: 'npm run check && jest' } },
  );
  assert.equal(merge.set.includes('scripts.test'), false);
});

test('removes and names the old ESLint packages', () => {
  const merge = mergePackage(`{"devDependencies": {
    "eslint-plugin-react": "1.0.0",
    "eslint-config-airbnb": "1.0.0",
    "@acme/eslint-plugin": "1.0.0",
    "@acme/eslint-plugin-extra": "1.0.0",
    "@acme/eslint-config": "1.0.0",
    "@acme/eslint-config-base": "1.0.0",
    "@typescript-eslint/parser": "1.0.0",
    "prettier": "1.0.0"
  }}`, 'install');

  assert.deepEqual(merge.removed, [
    'devDependencies.eslint-plugin-react',
    'devDependencies.eslint-config-airbnb',
    'devDependencies.@acme/eslint-plugin',
    'devDependencies.@acme/eslint-plugin-extra',
    'devDependencies.@acme/eslint-config',
    'devDependencies.@acme/eslint-config-base',
    'devDependencies.@typescript-eslint/parser',
  ]);
  assert.doesNotMatch(merge.text, /eslint-plugin-react|airbnb|@acme|@typescript-eslint\/parser/);
});

test('keeps the other devDependencies and the names that only look like ESLint packages', () => {
  const merge = mergePackage(`{"devDependencies": {
    "prettier": "1.0.0",
    "eslint-utils": "1.0.0",
    "@acme/eslint-pluginx": "1.0.0"
  }}`, 'install');

  assert.deepEqual(merge.removed, []);
  assert.match(merge.text, /"prettier": "1\.0\.0"/);
  assert.match(merge.text, /"eslint-utils": "1\.0\.0"/);
  assert.match(merge.text, /"@acme\/eslint-pluginx": "1\.0\.0"/);
});

test('sets a differing pin instead of removing it', () => {
  const merge = mergePackage(`{"devDependencies": {
    "@stylistic/eslint-plugin": "1.0.0",
    "@typescript-eslint/utils": "1.0.0"
  }}`, 'install');

  assert.deepEqual(merge.removed, ['devDependencies.@typescript-eslint/utils']);
  assert.ok(merge.set.includes('devDependencies.@stylistic/eslint-plugin'));
  assert.match(merge.text, /"@stylistic\/eslint-plugin": "5\.10\.0"/);
});

test('drops a legacy eslintConfig key at install', () => {
  const merge = mergePackage('{"eslintConfig": {"extends": "airbnb"}, "name": "app"}', 'install');

  assert.deepEqual(merge.removed, ['eslintConfig']);
  assert.doesNotMatch(merge.text, /eslintConfig/);
});

test('leaves the test, the packages and eslintConfig alone at upgrade', () => {
  const merge = mergePackage(`{
    "scripts": {"test": "jest"},
    "devDependencies": {"eslint-plugin-react": "1.0.0"},
    "eslintConfig": {"extends": "airbnb"}
  }`, 'upgrade');

  assert.partialDeepStrictEqual(JSON.parse(merge.text), {
    scripts: { test: 'jest' },
    eslintConfig: { extends: 'airbnb' },
  });
  assert.match(merge.text, /"eslint-plugin-react": "1\.0\.0"/);
  assert.deepEqual(merge.removed, []);
  assert.equal(merge.set.includes('scripts.test'), false);
});

test('sets the owned keys at upgrade', () => {
  const merge = mergePackage('{"type": "commonjs", "engines": {"node": ">=18"}}', 'upgrade');

  assert.deepEqual(merge.set, OWNED_KEYS);
});

test('lists no key whose value is already right', () => {
  const first = mergePackage('{"name": "app"}', 'install');
  const second = mergePackage(first.text, 'install');

  assert.deepEqual(second.set, []);
  assert.deepEqual(second.removed, []);
  assert.equal(second.text, first.text);
});

test('throws a package.json error for text that is not JSON', () => {
  assert.throws(
    () => mergePackage('{"name": ', 'install'),
    /^Error: package\.json is not valid JSON: .+/,
  );
});

test('throws a package.json error for a top level that is not an object', () => {
  assert.throws(
    () => mergePackage('[]', 'upgrade'),
    /^Error: package\.json is not a JSON object$/,
  );
});
