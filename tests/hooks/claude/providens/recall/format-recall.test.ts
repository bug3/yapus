import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRecall } from '../../../../../hooks/claude/providens/recall/format-recall.ts';

const TEXTS = { header: 'H {left-out}', cutMark: '[cut]', pathLine: 'P {path}' };
const TIME = '2026-11-15T10:00:00.000Z';

test('returns every prompt whole, oldest first, between the header and the path', () => {
  const prompts = [{ time: TIME, prompt: 'one' }, { time: TIME, prompt: 'two\nlines' }];

  assert.equal(
    formatRecall(TEXTS, prompts, '/p/s1.jsonl'),
    'H 0\n\n2026-11-15T10:00:00.000Z\none\n\n2026-11-15T10:00:00.000Z\ntwo\nlines\n\nP /p/s1.jsonl',
  );
});

test('cuts a prompt of 3,000 characters to its first 2,000 and the mark', () => {
  const prompts = [{ time: TIME, prompt: `${ 'a'.repeat(2000) }${ 'b'.repeat(1000) }` }];

  assert.equal(
    formatRecall(TEXTS, prompts, '/p'),
    `H 0\n\n${ TIME }\n${ 'a'.repeat(2000) }\n[cut]\n\nP /p`,
  );
});

test('cuts before a two-unit character that sits across the limit', () => {
  const prompts = [{ time: TIME, prompt: `${ 'a'.repeat(1999) }\u{1F600}${ 'b'.repeat(1000) }` }];
  const recall = formatRecall(TEXTS, prompts, '/p') ?? '';

  assert.deepEqual(
    [recall, recall.isWellFormed()],
    [`H 0\n\n${ TIME }\n${ 'a'.repeat(1999) }\n[cut]\n\nP /p`, true],
  );
});

test('leaves out the oldest prompts over the budget and names their count', () => {
  const prompts = [
    { time: 'old', prompt: 'x'.repeat(2000) },
    { time: 'mid', prompt: 'y'.repeat(2000) },
    { time: 'new', prompt: 'z'.repeat(2000) },
    { time: 'now', prompt: 'w'.repeat(2000) },
  ];
  const recall = formatRecall(TEXTS, prompts, '/p') ?? '';

  assert.deepEqual(
    [recall.startsWith('H 2\n\nnew\nz'), recall.includes('mid'), recall.length <= 6000],
    [true, false, true],
  );
});

test('keeps a path that holds a replacement pattern as it is', () => {
  const recall = formatRecall(TEXTS, [{ time: TIME, prompt: 'go' }], '/a$&b/s1.jsonl');

  assert.equal(recall, `H 0\n\n${ TIME }\ngo\n\nP /a$&b/s1.jsonl`);
});

test('returns undefined when the header and the path alone pass the budget', () => {
  assert.equal(formatRecall(TEXTS, [], `/${ 'p'.repeat(6000) }`), undefined);
});
