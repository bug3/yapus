import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import { CLOSE, items, OPEN, withBodies } from './items.ts';

test('splits a substitution in an unquoted body before its command', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n$(git reset --hard)\nEOF', undefined),
    items(
      OPEN,
      withBodies(['git', 'reset', '--hard'], []),
      CLOSE,
      withBodies(['cat'], ['$(git reset --hard)']),
    ),
  );
});

test('does not split a substitution in a quoted body', () => {
  assert.deepEqual(
    splitCommands("cat <<'EOF'\n$(git reset --hard)\nEOF", undefined),
    items(withBodies(['cat'], ['$(git reset --hard)'])),
  );
});

test('splits a backtick substitution in an unquoted body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n`git status`\nEOF', undefined),
    items(OPEN, withBodies(['git', 'status'], []), CLOSE, withBodies(['cat'], ['`git status`'])),
  );
});

test('does not split escaped substitutions in an unquoted body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n\\$(x) \\`x\\`\nEOF', undefined),
    items(withBodies(['cat'], ['\\$(x) \\`x\\`'])),
  );
});

test('ends a continued delimiter line and reads the next line as a command', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\nE\\\nOF\ngit reset --hard', undefined),
    items(withBodies(['cat'], ['']), withBodies(['git', 'reset', '--hard'], [])),
  );
});

test('does not continue a line of a quoted-delimiter body', () => {
  assert.deepEqual(
    splitCommands("cat <<'EOF'\nE\\\nOF\nEOF", undefined),
    items(withBodies(['cat'], ['E\\\nOF'])),
  );
});

test('does not join lines ending in an even number of backslashes', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\na\\\\\nEOF', undefined),
    items(withBodies(['cat'], ['a\\\\'])),
  );
});

test('keeps the inner tabs of a continued dash heredoc line in the delimiter test', () => {
  assert.deepEqual(
    splitCommands("cat <<-EOF\n\tE\\\n\t\tOF\ncat <<'Y'\nEOF\ngit push --force\nY", undefined),
    items(
      withBodies(['cat'], ["E\t\tOF\ncat <<'Y'"]),
      withBodies(['git', 'push', '--force'], []),
      withBodies(['Y'], []),
    ),
  );
});

test('fails when input ends inside a continuation', () => {
  assert.deepEqual(splitCommands('cat <<EOF\nEOF\\', undefined), {
    kind: 'failure',
    reason: 'unterminated heredoc',
  });
});

test('fails on an unclosed substitution in a body', () => {
  assert.deepEqual(splitCommands('cat <<EOF\n$(x\nEOF', undefined), {
    kind: 'failure',
    reason: 'unclosed $(',
  });
});

test('fails on a case statement in a substitution of an unquoted body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n$(case x in x) git push origin main --force; esac)\nEOF', undefined),
    { kind: 'failure', reason: 'case statement' },
  );
});

test('puts the substitutions of two heredocs before their commands in order', () => {
  assert.deepEqual(
    splitCommands('cat <<A | cat <<B\n$(a)\nA\n$(b)\nB', undefined),
    items(
      OPEN,
      withBodies(['a'], []),
      CLOSE,
      withBodies(['cat'], ['$(a)']),
      OPEN,
      withBodies(['b'], []),
      CLOSE,
      withBodies(['cat'], ['$(b)']),
    ),
  );
});

test('reads a braced expansion with a quoted default as one opaque word', () => {
  assert.deepEqual(splitCommands('echo "${x:-y}"', undefined), items({
    kind: 'command',
    words: [
      { text: 'echo', isOpaque: false, canSplit: false },
      { text: '${x:-y}', isOpaque: true, canSplit: false },
    ],
    heredocs: [],
  }));
});

test('fails on a substitution in a quoted default inside double quotes', () => {
  assert.deepEqual(splitCommands('echo "${x:-\'$(git reset --hard)\'}"', undefined), {
    kind: 'failure',
    reason: 'substitution inside ${...}',
  });
});

test('fails on a substitution in a quoted default outside double quotes', () => {
  assert.deepEqual(splitCommands("echo ${x:-'$(y)'}", undefined), {
    kind: 'failure',
    reason: 'substitution inside ${...}',
  });
});

test('fails on a heredoc delimiter written as an ANSI-C string', () => {
  assert.deepEqual(splitCommands("cat <<$'EOF'\nx\nEOF\ngit reset --hard", undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a parameter', () => {
  assert.deepEqual(splitCommands('cat <<"$X"\nx\n$X', undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a $"..." string', () => {
  assert.deepEqual(splitCommands('cat <<$"EOF"\nx\nEOF', undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a substitution', () => {
  assert.deepEqual(splitCommands('cat <<$(x)\nx\nEOF', undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a backtick substitution', () => {
  assert.deepEqual(splitCommands('cat <<`x`\nx\nEOF', undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});

test('fails on a heredoc delimiter that holds a braced parameter', () => {
  assert.deepEqual(splitCommands('cat <<${x}\nx\nEOF', undefined), {
    kind: 'failure',
    reason: 'heredoc delimiter the gate cannot read',
  });
});
