import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readReturnWords,
} from '../../../../../hooks/claude/delegator/contract/read-return-words.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { readShippedWords } from '../read-shipped-words.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..', '..');
const CONTRACT = join(ROOT, 'hooks', 'claude', 'delegator', 'contract', 'contract.md');
const AGENTS = join(ROOT, 'plugins', 'delegator', 'agents');
const SHAPE_REFUSAL = 'does not hold statuses as uppercase words and verdicts as words with a '
  + 'rework flag';

test('reads the statuses, the verdicts and the verdicts marked as rework', (t) => {
  const path = writeWords(t, JSON.stringify({
    statuses: ['DONE', 'STUCK'],
    verdicts: [{ word: 'PASS', rework: false }, { word: 'REDO', rework: true }],
  }));

  assert.deepEqual(readReturnWords(path), {
    statuses: ['DONE', 'STUCK'],
    verdicts: ['PASS', 'REDO'],
    reworkVerdicts: ['REDO'],
  });
});

test('refuses a missing file', (t) => {
  const path = join(makeTempDir(t), 'missing.json');

  assert.deepEqual(readReturnWords(path), { violation: `${ path } cannot be read; fix the file` });
});

test('refuses a file that is not JSON', (t) => {
  const path = writeWords(t, '{"statuses":');

  assert.deepEqual(readReturnWords(path), { violation: `${ path } is not JSON; fix the file` });
});

test('refuses a file of another shape', (t) => {
  const shapes = [
    '[]',
    '{"verdicts":[]}',
    '{"statuses":["done"],"verdicts":[]}',
    '{"statuses":[],"verdicts":[{"word":"GO"}]}',
    '{"statuses":[],"verdicts":[{"word":"GO","rework":"no"}]}',
  ];

  for (const shape of shapes) {
    const path = writeWords(t, shape);

    assert.deepEqual(
      readReturnWords(path),
      { violation: `${ path } ${ SHAPE_REFUSAL }; fix the file` },
      shape,
    );
  }
});

test('names only words the return contract asks for', () => {
  const contract = readFileSync(CONTRACT, 'utf8');

  assert.deepEqual(readShippedWords().statuses.filter((word) => !contract.includes(word)), []);
});

test('names only verdict words an agent definition asks for', () => {
  const definitions = readdirSync(AGENTS).map((file) => readFileSync(join(AGENTS, file), 'utf8'));

  assert.deepEqual(
    readShippedWords().verdicts.filter((word) => !definitions.some((text) => text.includes(word))),
    [],
  );
});

function writeWords(t: TestContext, text: string): string {
  const path = join(makeTempDir(t), 'return-words.json');

  writeFileSync(path, text);

  return path;
}
