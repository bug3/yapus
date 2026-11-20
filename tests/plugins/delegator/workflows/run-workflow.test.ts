import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';
import { runWorkflow } from './run-workflow.ts';

const META = 'export const meta = {\n  "name": "sample",\n  "phases": ["Scope"]\n}';
const JSON_NULL: unknown = JSON.parse('null');

test('gives back the meta of a script', async (t) => {
  const scriptPath = writeScript(t, [META, 'return 1;']);

  const run = await runWorkflow(scriptPath, {}, () => undefined);

  assert.deepEqual(run.meta, { name: 'sample', phases: ['Scope'] });
});

test('gives back the value a script returns from its args', async (t) => {
  const scriptPath = writeScript(t, [META, 'return { task: args.task, lanes: ["web"] };']);

  const run = await runWorkflow(scriptPath, { task: 'split' }, () => undefined);

  assert.deepEqual(run.returned, { task: 'split', lanes: ['web'] });
});

test('gives back undefined for a script that returns nothing', async (t) => {
  const scriptPath = writeScript(t, [META, 'log("ran");']);

  const run = await runWorkflow(scriptPath, {}, () => undefined);

  assert.equal(run.returned, undefined);
});

test('gives back the prompt and the options of each agent call', async (t) => {
  const scriptPath = writeScript(t, [
    META,
    'await agent("first prompt", { label: "scope", schema: { type: "object" } });',
    'await agent("second prompt", { label: "gather:Q1" });',
  ]);

  const run = await runWorkflow(scriptPath, {}, () => undefined);

  assert.deepEqual(run.calls, [
    { prompt: 'first prompt', options: { label: 'scope', schema: { type: 'object' } } },
    { prompt: 'second prompt', options: { label: 'gather:Q1' } },
  ]);
});

test('gives a script the answer to the agent call it made', async (t) => {
  const scriptPath = writeScript(t, [META, 'return await agent("prompt", { label: "scope" });']);

  const run = await runWorkflow(scriptPath, {}, (call) => ({ answered: call.options.label }));

  assert.deepEqual(run.returned, { answered: 'scope' });
});

test('gives a script null for an answer of JSON null', async (t) => {
  const scriptPath = writeScript(t, [
    META,
    'const answer = await agent("prompt", {});',
    'return { isNull: answer === null };',
  ]);

  const run = await runWorkflow(scriptPath, {}, () => JSON_NULL);

  assert.deepEqual(run.returned, { isNull: true });
});

test('gives a script a rejection for an answer that throws', async (t) => {
  const scriptPath = writeScript(t, [
    META,
    'return await agent("prompt", {}).catch((error) => "rejected: " + error.message);',
  ]);

  const run = await runWorkflow(scriptPath, {}, () => {
    throw new Error('agent died');
  });

  assert.equal(run.returned, 'rejected: agent died');
});

test('resolves parallel with what every function returns, in their order', async (t) => {
  const scriptPath = writeScript(t, [
    META,
    'return await parallel([() => agent("first", {}), () => agent("second", {})]);',
  ]);

  const run = await runWorkflow(scriptPath, {}, (call) => `answer to ${ call.prompt }`);

  assert.deepEqual(run.returned, ['answer to first', 'answer to second']);
});

test('gives back the lines a script logs', async (t) => {
  const scriptPath = writeScript(t, [META, 'log("scope: 3 questions");', 'log("wrote a file");']);

  const run = await runWorkflow(scriptPath, {}, () => undefined);

  assert.deepEqual(run.logs, ['scope: 3 questions', 'wrote a file']);
});

test('gives back the phases a script enters', async (t) => {
  const scriptPath = writeScript(t, [META, 'phase("Scope");', 'phase("Gather");']);

  const run = await runWorkflow(scriptPath, {}, () => undefined);

  assert.deepEqual(run.phases, ['Scope', 'Gather']);
});

test('rejects a meta that is not JSON', async (t) => {
  const scriptPath = writeScript(t, ["export const meta = {\n  name: 'sample',\n}", 'return 1;']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'SyntaxError',
    message: /JSON/,
  });
});

test('rejects a script that does not start with its meta', async (t) => {
  const scriptPath = writeScript(t, ['return 1;']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    message: `${ scriptPath }: no meta from "export const meta = " to a line that is "}" alone`,
  });
});

test('rejects a script that imports', async (t) => {
  const scriptPath = writeScript(t, [META, 'import { join } from "node:path";', 'return 1;']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'SyntaxError',
    message: 'Cannot use import statement outside a module',
  });
});

test('rejects a script that calls pipeline', async (t) => {
  const scriptPath = writeScript(t, [META, 'return await pipeline([]);']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'ReferenceError',
    message: 'pipeline is not defined',
  });
});

test('rejects a script that reads Date.now()', async (t) => {
  const scriptPath = writeScript(t, [META, 'return Date.now();']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'ReferenceError',
    message: 'Date is not defined',
  });
});

test('rejects a script that calls Math.random()', async (t) => {
  const scriptPath = writeScript(t, [META, 'return Math.random();']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'TypeError',
    message: 'Math.random is not a function',
  });
});

test('rejects a script that reads process', async (t) => {
  const scriptPath = writeScript(t, [META, 'return process.env;']);

  await assert.rejects(runWorkflow(scriptPath, {}, () => undefined), {
    name: 'ReferenceError',
    message: 'process is not defined',
  });
});

function writeScript(t: TestContext, scriptLines: readonly string[]): string {
  const scriptPath = join(makeTempDir(t), 'sample.js');

  writeFileSync(scriptPath, `${ scriptLines.join('\n') }\n`);

  return scriptPath;
}
