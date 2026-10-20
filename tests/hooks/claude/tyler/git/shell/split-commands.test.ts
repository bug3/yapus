import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import {
  command,
  commandOf,
  failure,
  item,
  items,
  whole,
  withBodies,
} from './items.ts';

test('yields no items for an empty line', () => {
  assert.deepEqual(splitCommands('', undefined), { kind: 'items', items: [] });
});

test('yields no items for a line of only blanks', () => {
  assert.deepEqual(splitCommands(' \t ', undefined), { kind: 'items', items: [] });
});

test('splits words on spaces', () => {
  assert.deepEqual(splitCommands('git  status', undefined), command('git', 'status'));
});

test('splits words on tabs', () => {
  assert.deepEqual(splitCommands('git\tstatus', undefined), command('git', 'status'));
});

test('ends a command at an unquoted newline', () => {
  assert.deepEqual(splitCommands('a\nb', undefined), items(item('a'), item('b')));
});

test('ends a command at &&', () => {
  assert.deepEqual(splitCommands('a && b', undefined), items(item('a'), item('b')));
});

test('ends a command at ||', () => {
  assert.deepEqual(splitCommands('a || b', undefined), items(item('a'), item('b')));
});

test('ends a command at a semicolon', () => {
  assert.deepEqual(splitCommands('a;b', undefined), items(item('a'), item('b')));
});

test('ends a command at a pipe', () => {
  assert.deepEqual(splitCommands('a | b', undefined), items(item('a'), item('b')));
});

test('ends a command at |&', () => {
  assert.deepEqual(splitCommands('a |& b', undefined), items(item('a'), item('b')));
});

test('ends a command at a single ampersand', () => {
  assert.deepEqual(splitCommands('a & b', undefined), items(item('a'), item('b')));
});

test('yields no item for an empty command between operators', () => {
  assert.deepEqual(splitCommands('a ; ; b\n\n', undefined), items(item('a'), item('b')));
});

test('fails on ;; as a case statement', () => {
  assert.deepEqual(splitCommands('a ;; b', undefined), failure('case statement'));
});

test('fails on case after a leading keyword', () => {
  assert.deepEqual(
    splitCommands('echo "$(if true; then case x in x) git push --force; esac; fi)"', undefined),
    failure('case statement'),
  );
  assert.deepEqual(splitCommands('! case x in', undefined), failure('case statement'));
  assert.deepEqual(splitCommands('until x; do case y in', undefined), failure('case statement'));
});

test('fails on a plain case word wherever it stands', () => {
  assert.deepEqual(splitCommands('time -p case x in', undefined), failure('case statement'));
  assert.deepEqual(splitCommands('echo case', undefined), failure('case statement'));
});

test('reads a quoted case as a plain word', () => {
  assert.deepEqual(splitCommands("echo 'case'", undefined), command('echo', 'case'));
});

test('keeps quoted operators literal', () => {
  assert.deepEqual(splitCommands('"a;b" \'&&\' c\\|d', undefined), command('a;b', '&&', 'c|d'));
});

test('yields open and close items for a scope', () => {
  assert.deepEqual(
    splitCommands('(a)', undefined),
    items({ kind: 'open' }, item('a'), { kind: 'close' }),
  );
});

test('nests scopes', () => {
  assert.deepEqual(
    splitCommands('(a; (b))', undefined),
    items(
      { kind: 'open' },
      item('a'),
      { kind: 'open' },
      item('b'),
      { kind: 'close' },
      { kind: 'close' },
    ),
  );
});

test('fails on a ) with no open', () => {
  assert.deepEqual(splitCommands('a )', undefined), failure('unmatched )'));
});

test('fails on an open left at the end', () => {
  assert.deepEqual(splitCommands('( a', undefined), failure('unclosed ('));
});

test('keeps a quoted $( literal', () => {
  assert.deepEqual(splitCommands("'$(' a", undefined), command('$(', 'a'));
});

test('ends a command at a standalone brace and yields no word for it', () => {
  assert.deepEqual(splitCommands('{ a; }', undefined), items(item('a')));
});

test('keeps a quoted brace as a word', () => {
  assert.deepEqual(splitCommands('"{" a{ {b', undefined), command('{', 'a{', '{b'));
});

test('starts a comment at a word-initial hash', () => {
  assert.deepEqual(splitCommands('a # b; c', undefined), command('a'));
});

test('ends a comment at an unquoted newline', () => {
  assert.deepEqual(splitCommands('a # b\nc', undefined), items(item('a'), item('c')));
});

test('keeps a quoted hash and a mid-word hash literal', () => {
  assert.deepEqual(splitCommands("'#a' b#c", undefined), command('#a', 'b#c'));
});

test('drops a redirection with its attached target', () => {
  assert.deepEqual(splitCommands('a >file b', undefined), command('a', 'b'));
});

test('drops a redirection with its detached target', () => {
  assert.deepEqual(splitCommands('a > file b', undefined), command('a', 'b'));
});

test('drops input, append, clobber and read-write redirections', () => {
  assert.deepEqual(splitCommands('a <f1 >>f2 >|f3 <>f4 b', undefined), command('a', 'b'));
});

test('drops redirections prefixed by digits', () => {
  assert.deepEqual(splitCommands('a 2>f 10> g b', undefined), command('a', 'b'));
});

test('drops a descriptor duplication', () => {
  assert.deepEqual(splitCommands('a 2>&1 b', undefined), command('a', 'b'));
});

test('drops &> and &>> with their targets', () => {
  assert.deepEqual(splitCommands('a &>f &>> g b', undefined), command('a', 'b'));
});

test('drops >&- as a close', () => {
  assert.deepEqual(splitCommands('a >&- b <&0 c', undefined), command('a', 'b', 'c'));
});

test('drops a here-string with its word', () => {
  assert.deepEqual(splitCommands('a <<< "x y" b', undefined), command('a', 'b'));
});

test('keeps a quoted redirection character literal', () => {
  assert.deepEqual(splitCommands('a ">" 2', undefined), command('a', '>', '2'));
});

test('fails on a redirection with no target at the end', () => {
  assert.deepEqual(splitCommands('a >', undefined), failure('redirection without a target'));
});

test('fails on a redirection with no target before an operator', () => {
  assert.deepEqual(splitCommands('a > ; b', undefined), failure('redirection without a target'));
});

test('fails on a redirection followed by a redirection', () => {
  assert.deepEqual(splitCommands('a > >b', undefined), failure('redirection without a target'));
});

test('fails on a heredoc without a body', () => {
  assert.deepEqual(splitCommands('a <<EOF', undefined), failure('unterminated heredoc'));
});

test('fails on a dash heredoc without a body', () => {
  assert.deepEqual(splitCommands('a <<-EOF', undefined), failure('unterminated heredoc'));
});

test('fails on a heredoc without a delimiter', () => {
  assert.deepEqual(splitCommands('a <<', undefined), failure('heredoc without a delimiter'));
});

test('fails on a heredoc whose delimiter line never comes', () => {
  assert.deepEqual(splitCommands('a <<EOF\nx\nEOFS', undefined), failure('unterminated heredoc'));
});

test('reads a heredoc with a bare delimiter', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('reads a heredoc with a single-quoted delimiter', () => {
  assert.deepEqual(
    splitCommands("cat <<'EOF'\nhi\nEOF", undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('reads a heredoc with a double-quoted delimiter', () => {
  assert.deepEqual(
    splitCommands('cat <<"EOF"\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('reads a heredoc with a backslash delimiter', () => {
  assert.deepEqual(
    splitCommands('cat <<\\EOF\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('reads a heredoc with a partly quoted delimiter', () => {
  assert.deepEqual(
    splitCommands('cat <<E"OF"\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('reads a heredoc delimiter after a blank', () => {
  assert.deepEqual(
    splitCommands('cat << EOF\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi'])),
  );
});

test('strips leading tabs of a dash heredoc body and delimiter', () => {
  assert.deepEqual(
    splitCommands('cat <<-EOF\n\t\ta\n\tb\n\t\tEOF', undefined),
    items(withBodies(['cat'], ['a\nb'])),
  );
});

test('keeps leading tabs of a plain heredoc body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n\ta\nEOF', undefined),
    items(withBodies(['cat'], ['\ta'])),
  );
});

test('reads two heredocs of one line in order', () => {
  assert.deepEqual(
    splitCommands('cat <<A <<B\none\nA\ntwo\nB', undefined),
    items(withBodies(['cat'], ['one', 'two'])),
  );
});

test('splits the rest of the heredoc line as usual', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF | wc -l\nhi\nEOF', undefined),
    items(withBodies(['cat'], ['hi']), item('wc', '-l')),
  );
});

test('reads a heredoc body as raw text', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n(a) \'b\' "c" # d; e\nEOF', undefined),
    items(withBodies(['cat'], ['(a) \'b\' "c" # d; e'])),
  );
});

test('reads an empty heredoc body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\nEOF', undefined),
    items(withBodies(['cat'], [''])),
  );
});

test('continues with the line after a heredoc', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\nhi\nEOF\nb', undefined),
    items(withBodies(['cat'], ['hi']), item('b')),
  );
});

test('replaces a leading tilde alone with home', () => {
  assert.deepEqual(splitCommands('~', '/h'), command('/h'));
});

test('replaces a leading tilde before a slash with home', () => {
  assert.deepEqual(splitCommands('~/x', '/h'), command('/h/x'));
});

test('marks a leading tilde opaque when home is unknown', () => {
  assert.deepEqual(splitCommands('~/x', undefined), commandOf(whole('~/x')));
});

test('marks ~name opaque', () => {
  assert.deepEqual(splitCommands('~bob/x', '/h'), commandOf(whole('~bob/x')));
});

test('keeps a quoted tilde literal', () => {
  assert.deepEqual(splitCommands('"~/x" \\~', '/h'), command('~/x', '~'));
});

test('keeps a tilde inside a word literal', () => {
  assert.deepEqual(splitCommands('a~b', '/h'), command('a~b'));
});

test('keeps single-quoted text literal', () => {
  assert.deepEqual(splitCommands("'a b\\n$x\"'", undefined), command('a b\\n$x"'));
});

test('keeps double-quoted spaces in one word', () => {
  assert.deepEqual(splitCommands('"a b"', undefined), command('a b'));
});

test('unescapes a backslash before a double quote, backslash, dollar or backtick', () => {
  assert.deepEqual(splitCommands('"\\"\\\\\\$\\`"', undefined), command('"\\$`'));
});

test('keeps a backslash before any other character inside double quotes', () => {
  assert.deepEqual(splitCommands('"\\n"', undefined), command('\\n'));
});

test('removes a backslash-newline inside double quotes', () => {
  assert.deepEqual(splitCommands('"a\\\nb"', undefined), command('ab'));
});

test('makes a character literal after an unquoted backslash', () => {
  assert.deepEqual(splitCommands('a\\ b \\"\\\\', undefined), command('a b', '"\\'));
});

test('removes an unquoted backslash-newline', () => {
  assert.deepEqual(splitCommands('a\\\nb', undefined), command('ab'));
});

test('yields no word for a backslash-newline between blanks', () => {
  assert.deepEqual(splitCommands('a \\\n b', undefined), command('a', 'b'));
});

test('joins quotes and adjacent text into one word', () => {
  assert.deepEqual(splitCommands('a"b c"\'d\'', undefined), command('ab cd'));
});

test('yields a word with empty text for empty quotes', () => {
  assert.deepEqual(splitCommands("'' \"\"", undefined), command('', ''));
});

test('fails on an unterminated single quote', () => {
  assert.deepEqual(splitCommands("a 'b", undefined), {
    kind: 'failure',
    reason: 'unterminated single quote',
  });
});

test('fails on an unterminated double quote', () => {
  assert.deepEqual(splitCommands('a "b', undefined), {
    kind: 'failure',
    reason: 'unterminated double quote',
  });
});

test('fails on a trailing lone backslash', () => {
  assert.deepEqual(splitCommands('a\\', undefined), {
    kind: 'failure',
    reason: 'trailing backslash',
  });
});
