import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { makeTempRepo } from '../../helpers/make-temp-repo.ts';
import { getEmitViolations } from './get-emit-violations.ts';

const NO_EMIT = '{ "compilerOptions": { "noEmit": true } }\n';
const NODE_24 = '{ "engines": { "node": ">=24" } }\n';

test('finds nothing in a repository that emits nothing', (t) => {
  const root = makeRepo(t, NO_EMIT, NODE_24);

  assert.deepEqual(getEmitViolations(root), []);
});

test('names a tsconfig that emits', (t) => {
  const root = makeRepo(t, '{ "compilerOptions": {} }\n', NODE_24);

  assert.deepEqual(getEmitViolations(root), ['tsconfig.json: noEmit is not true']);
});

test('follows a relative extends to the noEmit it sets', (t) => {
  const root = makeRepo(t, '{ "extends": "./base/tsconfig.json" }\n', NODE_24);

  mkdirSync(join(root, 'base'));
  writeFileSync(join(root, 'base', 'tsconfig.json'), NO_EMIT);

  assert.deepEqual(getEmitViolations(root), []);
});

test('names a tsconfig whose extends chain never sets noEmit', (t) => {
  const root = makeRepo(t, '{ "extends": "./base" }\n', NODE_24);

  writeFileSync(join(root, 'base.json'), '{ "extends": "./tsconfig.json" }\n');

  assert.deepEqual(getEmitViolations(root), ['tsconfig.json: noEmit is not true']);
});

test('names a manifest that admits an older Node', (t) => {
  const root = makeRepo(t, NO_EMIT, '{ "engines": { "node": ">=22" } }\n');

  assert.deepEqual(getEmitViolations(root), ['package.json: engines.node is not >=24']);
});

test('names a manifest that is not JSON', (t) => {
  const root = makeRepo(t, NO_EMIT, '{\n');

  assert.deepEqual(getEmitViolations(root), ['package.json: engines.node is not >=24']);
});

test('names every JavaScript file kept in the repository', (t) => {
  const root = makeRepo(t, NO_EMIT, NODE_24);

  writeFileSync(join(root, 'a.js'), '');
  writeFileSync(join(root, 'b.mjs'), '');

  assert.deepEqual(getEmitViolations(root), [
    'a.js: emitted JavaScript',
    'b.mjs: emitted JavaScript',
  ]);
});

test('finds nothing for a workflow script of a plugin', (t) => {
  const root = makeRepo(t, NO_EMIT, NODE_24);

  mkdirSync(join(root, 'plugins', 'x', 'workflows'), { recursive: true });
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'a.js'), '');

  assert.deepEqual(getEmitViolations(root), []);
});

test('names JavaScript that is not a workflow script of a plugin', (t) => {
  const root = makeRepo(t, NO_EMIT, NODE_24);

  mkdirSync(join(root, 'plugins', 'x', 'workflows', 'sub'), { recursive: true });
  writeFileSync(join(root, 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'sub', 'a.js'), '');
  writeFileSync(join(root, 'plugins', 'x', 'workflows', 'a.mjs'), '');

  assert.deepEqual(getEmitViolations(root).sort(), [
    'a.js: emitted JavaScript',
    'plugins/x/a.js: emitted JavaScript',
    'plugins/x/workflows/a.mjs: emitted JavaScript',
    'plugins/x/workflows/sub/a.js: emitted JavaScript',
  ]);
});

function makeRepo(t: TestContext, tsconfig: string, manifest: string): string {
  const root = makeTempRepo(t);

  writeFileSync(join(root, 'tsconfig.json'), tsconfig);
  writeFileSync(join(root, 'package.json'), manifest);

  return root;
}
