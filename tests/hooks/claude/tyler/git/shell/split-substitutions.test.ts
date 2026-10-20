import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import { CLOSE, failure, item, items, OPEN } from './items.ts';

function opaqueItem(plain: string, opaqueText: string): unknown {
  return {
    kind: 'command',
    words: [
      { text: plain, isOpaque: false },
      { text: opaqueText, isOpaque: true },
    ],
    heredocs: [],
  };
}

test('splits the inside of $( and emits it before the command', () => {
  assert.deepEqual(
    splitCommands('echo $(git reset --hard)', undefined),
    items(OPEN, item('git', 'reset', '--hard'), CLOSE, opaqueItem('echo', '$(git reset --hard)')),
  );
});

test('splits a $( inside double quotes', () => {
  assert.deepEqual(
    splitCommands('a "$(b)"', undefined),
    items(OPEN, item('b'), CLOSE, opaqueItem('a', '$(b)')),
  );
});

test('keeps heredocs and parentheses inside $( apart from the closing one', () => {
  const line = [
    'git commit -m "$(cat <<\'EOF\'',
    'fix(x): y (M10)',
    '',
    'body with ) and (',
    'EOF',
    ')"',
  ].join('\n');

  assert.deepEqual(
    splitCommands(line, undefined),
    items(
      OPEN,
      {
        kind: 'command',
        words: [{ text: 'cat', isOpaque: false }],
        heredocs: ['fix(x): y (M10)\n\nbody with ) and ('],
      },
      CLOSE,
      {
        kind: 'command',
        words: [
          { text: 'git', isOpaque: false },
          { text: 'commit', isOpaque: false },
          { text: '-m', isOpaque: false },
          {
            text: "$(cat <<'EOF'\nfix(x): y (M10)\n\nbody with ) and (\nEOF\n)",
            isOpaque: true,
          },
        ],
        heredocs: [],
      },
    ),
  );
});

test('splits operators inside $(', () => {
  assert.deepEqual(
    splitCommands('a $(b && c)', undefined),
    items(OPEN, item('b'), item('c'), CLOSE, opaqueItem('a', '$(b && c)')),
  );
});

test('fails on an unclosed $(', () => {
  assert.deepEqual(splitCommands('a $(b', undefined), failure('unclosed $('));
});

test('handles $(( like $(', () => {
  assert.deepEqual(
    splitCommands('a $((b))', undefined),
    items(OPEN, OPEN, item('b'), CLOSE, CLOSE, opaqueItem('a', '$((b))')),
  );
});

test('splits the inside of backticks', () => {
  assert.deepEqual(
    splitCommands('a `b`', undefined),
    items(OPEN, item('b'), CLOSE, opaqueItem('a', '`b`')),
  );
});

test('splits backticks inside double quotes', () => {
  assert.deepEqual(
    splitCommands('a "`b`"', undefined),
    items(OPEN, item('b'), CLOSE, opaqueItem('a', '`b`')),
  );
});

test('unescapes a dollar inside backticks before splitting', () => {
  assert.deepEqual(
    splitCommands('a `b \\$(c)`', undefined),
    items(
      OPEN,
      OPEN,
      item('c'),
      CLOSE,
      opaqueItem('b', '$(c)'),
      CLOSE,
      opaqueItem('a', '`b \\$(c)`'),
    ),
  );
});

test('splits a substitution nested in backticks after unescaping', () => {
  assert.deepEqual(
    splitCommands('a `b \\`c\\``', undefined),
    items(
      OPEN,
      OPEN,
      item('c'),
      CLOSE,
      opaqueItem('b', '`c`'),
      CLOSE,
      opaqueItem('a', '`b \\`c\\``'),
    ),
  );
});

test('unescapes a double quote inside backticks inside double quotes', () => {
  assert.deepEqual(
    splitCommands('echo "`git push \\"--force\\"`"', undefined),
    items(
      OPEN,
      item('git', 'push', '--force'),
      CLOSE,
      opaqueItem('echo', '`git push \\"--force\\"`'),
    ),
  );
});

test('fails on an unclosed backtick', () => {
  assert.deepEqual(splitCommands('a `b', undefined), failure('unclosed backtick'));
});

test('splits a process substitution with <(', () => {
  assert.deepEqual(
    splitCommands('diff <(git show x) y', undefined),
    items(OPEN, item('git', 'show', 'x'), CLOSE, {
      kind: 'command',
      words: [
        { text: 'diff', isOpaque: false },
        { text: '<(git show x)', isOpaque: true },
        { text: 'y', isOpaque: false },
      ],
      heredocs: [],
    }),
  );
});

test('splits a process substitution with >(', () => {
  assert.deepEqual(
    splitCommands('a >(b)', undefined),
    items(OPEN, item('b'), CLOSE, opaqueItem('a', '>(b)')),
  );
});

test('splits a substitution in a redirection target', () => {
  assert.deepEqual(
    splitCommands('a > $(b)', undefined),
    items(OPEN, item('b'), CLOSE, item('a')),
  );
});

test('splits a substitution in an attached redirection target', () => {
  assert.deepEqual(
    splitCommands('a >$(b)', undefined),
    items(OPEN, item('b'), CLOSE, item('a')),
  );
});

test('splits substitutions nested to depth 3', () => {
  assert.deepEqual(
    splitCommands('a $(b $(c $(d)))', undefined),
    items(
      OPEN,
      OPEN,
      OPEN,
      item('d'),
      CLOSE,
      opaqueItem('c', '$(d)'),
      CLOSE,
      opaqueItem('b', '$(c $(d))'),
      CLOSE,
      opaqueItem('a', '$(b $(c $(d)))'),
    ),
  );
});

test('fails on substitutions nested to depth 4', () => {
  assert.deepEqual(
    splitCommands('a $(b $(c $(d $(e))))', undefined),
    failure('substitutions nested too deep'),
  );
});

test('marks a $name word opaque with no extra items', () => {
  assert.deepEqual(splitCommands('a $b', undefined), items(opaqueItem('a', '$b')));
});

test('marks a ${name} word opaque with no extra items', () => {
  assert.deepEqual(splitCommands('a ${b}', undefined), items(opaqueItem('a', '${b}')));
});

test('marks a quoted $name word opaque with no extra items', () => {
  assert.deepEqual(splitCommands('a "$b"', undefined), items(opaqueItem('a', '$b')));
});

test('marks a positional parameter opaque', () => {
  assert.deepEqual(splitCommands('a $1', undefined), items(opaqueItem('a', '$1')));
});

test('marks a special parameter opaque', () => {
  assert.deepEqual(splitCommands('a $@', undefined), items(opaqueItem('a', '$@')));
});

test('reads ${...} to its matching brace past a quoted brace', () => {
  assert.deepEqual(
    splitCommands('a ${b:-"}"} c', undefined),
    items({
      kind: 'command',
      words: [
        { text: 'a', isOpaque: false },
        { text: '${b:-"}"}', isOpaque: true },
        { text: 'c', isOpaque: false },
      ],
      heredocs: [],
    }),
  );
});

test('fails on a $( inside ${...}', () => {
  assert.deepEqual(
    splitCommands('a ${b:-$(c)}', undefined),
    failure('substitution inside ${...}'),
  );
});

test('fails on a backtick inside ${...}', () => {
  assert.deepEqual(
    splitCommands('a ${b:-`c`}', undefined),
    failure('substitution inside ${...}'),
  );
});

test('fails on a case statement that would close a substitution early', () => {
  assert.deepEqual(
    splitCommands('echo "$(case x in x) git push origin main --force; esac)"', undefined),
    failure('case statement'),
  );
});

test('reads a lone dollar as a literal', () => {
  assert.deepEqual(splitCommands('a $ b', undefined), items(item('a', '$', 'b')));
});

test('reads a dollar before a slash as a literal', () => {
  assert.deepEqual(splitCommands('a $/b', undefined), items(item('a', '$/b')));
});

test('marks a $\'...\' word opaque and ends it at an unescaped quote', () => {
  assert.deepEqual(splitCommands("a $'b\\'c' d", undefined), items({
    kind: 'command',
    words: [
      { text: 'a', isOpaque: false },
      { text: "$'b\\'c'", isOpaque: true },
      { text: 'd', isOpaque: false },
    ],
    heredocs: [],
  }));
});

test('marks a $"..." word opaque', () => {
  assert.deepEqual(splitCommands('a $"b c"', undefined), items(opaqueItem('a', 'b c')));
});

test('keeps a single-quoted $( literal', () => {
  assert.deepEqual(splitCommands("a '$(x)'", undefined), items(item('a', '$(x)')));
});

test('keeps a backslash-escaped $ literal', () => {
  assert.deepEqual(splitCommands('a \\$x', undefined), items(item('a', '$x')));
});

test('keeps a backslash-escaped $( literal inside double quotes', () => {
  assert.deepEqual(splitCommands('a "\\$(x)"', undefined), items(item('a', '$(x)')));
});

test('keeps backslash-escaped backticks literal', () => {
  assert.deepEqual(splitCommands('a \\`x\\`', undefined), items(item('a', '`x`')));
});
