import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readHeredoc } from '../../../../../../hooks/claude/tyler/git/shell/read-heredoc.ts';

const CONTEXT = { home: undefined, level: 0 };
const DEEP = { home: undefined, level: 3 };
const PLAIN_HEREDOC = { delimiter: 'EOF', isTabStripped: false, isQuoted: false };
const PLAIN = { heredoc: PLAIN_HEREDOC, context: CONTEXT };
const STRIPPED = { heredoc: { ...PLAIN_HEREDOC, isTabStripped: true }, context: CONTEXT };
const QUOTED = { heredoc: { ...PLAIN_HEREDOC, isQuoted: true }, context: CONTEXT };

test('reads lines up to the delimiter line', () => {
  assert.deepEqual(readHeredoc('a\nb\nEOF\nc', 0, PLAIN), {
    kind: 'body',
    items: [],
    text: 'a\nb',
    end: 8,
  });
});

test('starts reading at the given position', () => {
  assert.deepEqual(readHeredoc('x\na\nEOF', 2, PLAIN), {
    kind: 'body',
    items: [],
    text: 'a',
    end: 7,
  });
});

test('ends at the end of input after a final delimiter line', () => {
  assert.deepEqual(readHeredoc('EOF', 0, PLAIN), { kind: 'body', items: [], text: '', end: 3 });
});

test('does not strip tabs from a plain delimiter line', () => {
  assert.deepEqual(readHeredoc('\tEOF', 0, PLAIN), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});

test('strips tabs from a dash body line', () => {
  assert.deepEqual(readHeredoc('\t\ta\nEOF', 0, STRIPPED), {
    kind: 'body',
    items: [],
    text: 'a',
    end: 7,
  });
});

test('fails when input ends before the delimiter line', () => {
  assert.deepEqual(readHeredoc('a\n', 0, PLAIN), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});

test('joins a line ending in a backslash with the next before the delimiter test', () => {
  assert.deepEqual(readHeredoc('a\nE\\\nOF\nb', 0, PLAIN), {
    kind: 'body',
    text: 'a',
    items: [],
    end: 8,
  });
});

test('keeps the joined text in the body', () => {
  assert.deepEqual(readHeredoc('x\\\ny\nEOF', 0, PLAIN), {
    kind: 'body',
    text: 'xy',
    items: [],
    end: 8,
  });
});

test('does not join a quoted delimiter body', () => {
  assert.deepEqual(readHeredoc('E\\\nOF\nEOF', 0, QUOTED), {
    kind: 'body',
    text: 'E\\\nOF',
    items: [],
    end: 9,
  });
});

test('does not join a line ending in an even number of backslashes', () => {
  assert.deepEqual(readHeredoc('a\\\\\nEOF', 0, PLAIN), {
    kind: 'body',
    text: 'a\\\\',
    items: [],
    end: 7,
  });
});

test('strips tabs once from the joined line', () => {
  assert.deepEqual(readHeredoc('\tx\\\n\t\ty\n\tEOF', 0, STRIPPED), {
    kind: 'body',
    text: 'x\t\ty',
    items: [],
    end: 12,
  });
});

test('fails when input ends inside a continuation', () => {
  assert.deepEqual(readHeredoc('a\nEOF\\', 0, PLAIN), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});

test('reads a substitution of an unquoted body', () => {
  assert.deepEqual(readHeredoc('$(x)\nEOF', 0, PLAIN), {
    kind: 'body',
    text: '$(x)',
    items: [
      { kind: 'open' },
      {
        kind: 'command',
        words: [{ text: 'x', isOpaque: false, canSplit: false }],
        heredocs: [],
        hasRedirection: false, inputTargets: [],
      },
      { kind: 'close' },
    ],
    end: 8,
  });
});

test('reads no substitution of a quoted body', () => {
  assert.deepEqual(readHeredoc('$(x)\nEOF', 0, QUOTED), {
    kind: 'body',
    text: '$(x)',
    items: [],
    end: 8,
  });
});

test('reads a backtick substitution of an unquoted body', () => {
  assert.deepEqual(readHeredoc('`x`\nEOF', 0, PLAIN), {
    kind: 'body',
    text: '`x`',
    items: [
      { kind: 'open' },
      {
        kind: 'command',
        words: [{ text: 'x', isOpaque: false, canSplit: false }],
        heredocs: [],
        hasRedirection: false, inputTargets: [],
      },
      { kind: 'close' },
    ],
    end: 7,
  });
});

test('keeps an escaped substitution literal', () => {
  assert.deepEqual(readHeredoc('\\$(x) \\`x\\`\nEOF', 0, PLAIN), {
    kind: 'body',
    text: '\\$(x) \\`x\\`',
    items: [],
    end: 15,
  });
});

test('fails on an unclosed substitution in a body', () => {
  assert.deepEqual(readHeredoc('$(x\nEOF', 0, PLAIN), { kind: 'failure', reason: 'unclosed $(' });
});

test('fails on a substitution nested too deep in a body', () => {
  assert.deepEqual(readHeredoc('$(x)\nEOF', 0, { ...PLAIN, context: DEEP }), {
    kind: 'failure',
    reason: 'substitutions nested too deep',
  });
});
