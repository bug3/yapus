import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatRecall } from '../../../../../hooks/claude/delegator/recall/format-recall.ts';

const TEXTS = {
  header: 'H {left-out}',
  cutMark: '[cut]',
  pathLine: 'P {path}',
  plansLine: 'L {plans}.',
  notice: 'N',
};
const TIME = '2026-11-15T10:00:00.000Z';
const NO_PLANS = { logPath: '/p', planPaths: [], hasOlderLayout: false };

test('returns every prompt whole, oldest first, between the header and the path', () => {
  const prompts = [{ time: TIME, prompt: 'one' }, { time: TIME, prompt: 'two\nlines' }];

  assert.equal(
    formatRecall(TEXTS, prompts, { ...NO_PLANS, logPath: '/p/s1.jsonl' }),
    'H 0\n\n2026-11-15T10:00:00.000Z\none\n\n2026-11-15T10:00:00.000Z\ntwo\nlines\n\nP /p/s1.jsonl',
  );
});

test('cuts a prompt of 3,000 characters to its first 2,000 and the mark', () => {
  const prompts = [{ time: TIME, prompt: `${ 'a'.repeat(2000) }${ 'b'.repeat(1000) }` }];

  assert.equal(
    formatRecall(TEXTS, prompts, NO_PLANS),
    `H 0\n\n${ TIME }\n${ 'a'.repeat(2000) }\n[cut]\n\nP /p`,
  );
});

test('cuts before a two-unit character that sits across the limit', () => {
  const prompts = [{ time: TIME, prompt: `${ 'a'.repeat(1999) }\u{1F600}${ 'b'.repeat(1000) }` }];
  const recall = formatRecall(TEXTS, prompts, NO_PLANS) ?? '';

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
  const recall = formatRecall(TEXTS, prompts, NO_PLANS) ?? '';

  assert.deepEqual(
    [recall.startsWith('H 2\n\nnew\nz'), recall.includes('mid'), recall.length <= 6000],
    [true, false, true],
  );
});

test('keeps a path that holds a replacement pattern as it is', () => {
  const recall = formatRecall(TEXTS, [{ time: TIME, prompt: 'go' }], {
    ...NO_PLANS,
    logPath: '/a$&b/s1.jsonl',
  });

  assert.equal(recall, `H 0\n\n${ TIME }\ngo\n\nP /a$&b/s1.jsonl`);
});

test('returns undefined when the header and the path alone pass the budget', () => {
  assert.equal(formatRecall(TEXTS, [{ time: TIME, prompt: 'go' }], {
    ...NO_PLANS,
    logPath: `/${ 'p'.repeat(6000) }`,
  }), undefined);
});

test('ends with the plans line after the path, the paths in the order given', () => {
  const recall = formatRecall(TEXTS, [{ time: TIME, prompt: 'go' }], {
    ...NO_PLANS,
    planPaths: ['/r/b.md', '/r/a.md'],
  });

  assert.equal(recall, `H 0\n\n${ TIME }\ngo\n\nP /p\n\nL /r/b.md, /r/a.md.`);
});

test('returns the plans line alone when no prompt is logged', () => {
  assert.equal(formatRecall(TEXTS, [], { ...NO_PLANS, planPaths: ['/r/a.md'] }), 'L /r/a.md.');
});

// Three prompts of 1,980 characters fit with the path line alone and not with
// a plans line of 44 characters beside it.
test('counts the plans line inside the budget and leaves out one more prompt', () => {
  const prompts = [
    { time: 'old', prompt: 'x'.repeat(1980) },
    { time: 'mid', prompt: 'y'.repeat(1980) },
    { time: 'new', prompt: 'z'.repeat(1980) },
  ];
  const planPaths = [`/${ 'q'.repeat(40) }`];
  const recall = formatRecall(TEXTS, prompts, { ...NO_PLANS, planPaths });
  const withoutPlans = formatRecall(TEXTS, prompts, NO_PLANS) ?? '';

  assert.deepEqual(
    [withoutPlans.startsWith('H 0\n\nold'), recall?.startsWith('H 1\n\nmid'), recall?.length],
    [true, true, 4027],
  );
});

test('ends with the notice after the plans line when the project holds an older layout', () => {
  const recall = formatRecall(TEXTS, [{ time: TIME, prompt: 'go' }], {
    logPath: '/p',
    planPaths: ['/r/a.md'],
    hasOlderLayout: true,
  });

  assert.equal(recall, `H 0\n\n${ TIME }\ngo\n\nP /p\n\nL /r/a.md.\n\nN`);
});

test('returns the notice alone when no prompt is logged and there is no plan path', () => {
  assert.equal(formatRecall(TEXTS, [], { ...NO_PLANS, hasOlderLayout: true }), 'N');
});

// Three prompts of 1,980 characters fit with the path line alone and not with
// a notice of 44 characters beside it.
test('counts the notice inside the budget and leaves out one more prompt', () => {
  const texts = { ...TEXTS, notice: 'N'.repeat(44) };
  const prompts = [
    { time: 'old', prompt: 'x'.repeat(1980) },
    { time: 'mid', prompt: 'y'.repeat(1980) },
    { time: 'new', prompt: 'z'.repeat(1980) },
  ];
  const recall = formatRecall(texts, prompts, { ...NO_PLANS, hasOlderLayout: true });
  const withoutNotice = formatRecall(texts, prompts, NO_PLANS) ?? '';

  assert.deepEqual(
    [withoutNotice.startsWith('H 0\n\nold'), recall?.startsWith('H 1\n\nmid'), recall?.length],
    [true, true, 4027],
  );
});
