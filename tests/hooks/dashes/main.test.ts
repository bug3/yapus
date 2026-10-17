import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const HOOKS = join(import.meta.dirname, '..', '..', '..', 'hooks');
const MAIN = join(HOOKS, 'dashes', 'main.ts');
const RUN_SH = join(HOOKS, 'run.sh');
const EM_DASH = String.fromCodePoint(0x2014);
const DASH_WRITE = JSON.stringify({
  tool_name: 'Write',
  tool_input: { file_path: '/r/a.md', content: EM_DASH },
});

test('exits 2 and writes the finding to stderr for a Write that adds a dash', () => {
  const result = runHook(DASH_WRITE);

  assert.deepEqual(
    [result.status, result.stdout, result.stderr],
    [2, '', 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n'],
  );
});

test('exits 0 with no output for a Write with only ASCII hyphens', () => {
  const stdinText = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: '/r/a.md', content: 'a - b\n' },
  });

  const result = runHook(stdinText);

  assert.deepEqual([result.status, result.stdout, result.stderr], [0, '', '']);
});

test('exits 2 for stdin that is not JSON', () => {
  const result = runHook('{');

  assert.equal(result.status, 2);
});

test('exits 2 when stdin stays open past the time limit', { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, [MAIN], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';

  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });

  const status = await new Promise((resolve) => {
    child.on('close', (code) => {
      resolve(code);
    });
  });

  child.stdin.destroy();

  assert.deepEqual(
    [status, stderr],
    [2, 'yapus dashes: no answer within 5 seconds; the call is blocked, retry it\n'],
  );
});

test('exits 2 through the bash entry point for a Write that adds a dash', () => {
  const result = spawnSync('bash', [RUN_SH, 'dashes'], { encoding: 'utf8', input: DASH_WRITE });

  assert.deepEqual(
    [result.status, result.stderr],
    [2, 'yapus dashes: /r/a.md:1: U+2014; use the ASCII hyphen\n'],
  );
});

function runHook(stdinText: string) {
  return spawnSync(process.execPath, [MAIN], { encoding: 'utf8', input: stdinText });
}
