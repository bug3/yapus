import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

const OPEN = { kind: 'open' };
const CLOSE = { kind: 'close' };

function command(texts: readonly string[], heredocs: readonly string[]): unknown {
  return {
    kind: 'command',
    words: texts.map((text) => ({ text, isOpaque: false })),
    heredocs,
  };
}

function items(...list: readonly unknown[]): unknown {
  return { kind: 'items', items: list };
}

test('splits a substitution in an unquoted body before its command', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n$(git reset --hard)\nEOF', undefined),
    items(
      OPEN,
      command(['git', 'reset', '--hard'], []),
      CLOSE,
      command(['cat'], ['$(git reset --hard)']),
    ),
  );
});

test('does not split a substitution in a quoted body', () => {
  assert.deepEqual(
    splitCommands("cat <<'EOF'\n$(git reset --hard)\nEOF", undefined),
    items(command(['cat'], ['$(git reset --hard)'])),
  );
});

test('splits a backtick substitution in an unquoted body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n`git status`\nEOF', undefined),
    items(OPEN, command(['git', 'status'], []), CLOSE, command(['cat'], ['`git status`'])),
  );
});

test('does not split escaped substitutions in an unquoted body', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\n\\$(x) \\`x\\`\nEOF', undefined),
    items(command(['cat'], ['\\$(x) \\`x\\`'])),
  );
});

test('ends a continued delimiter line and reads the next line as a command', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\nE\\\nOF\ngit reset --hard', undefined),
    items(command(['cat'], ['']), command(['git', 'reset', '--hard'], [])),
  );
});

test('does not continue a line of a quoted-delimiter body', () => {
  assert.deepEqual(
    splitCommands("cat <<'EOF'\nE\\\nOF\nEOF", undefined),
    items(command(['cat'], ['E\\\nOF'])),
  );
});

test('does not join lines ending in an even number of backslashes', () => {
  assert.deepEqual(
    splitCommands('cat <<EOF\na\\\\\nEOF', undefined),
    items(command(['cat'], ['a\\\\'])),
  );
});

test('joins tab-indented continued lines of a dash heredoc', () => {
  assert.deepEqual(
    splitCommands('cat <<-EOF\n\tE\\\n\t\tOF\n\tgit status', undefined),
    items(command(['cat'], ['']), command(['git', 'status'], [])),
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

test('puts the substitutions of two heredocs before their commands in order', () => {
  assert.deepEqual(
    splitCommands('cat <<A | cat <<B\n$(a)\nA\n$(b)\nB', undefined),
    items(
      OPEN,
      command(['a'], []),
      CLOSE,
      command(['cat'], ['$(a)']),
      OPEN,
      command(['b'], []),
      CLOSE,
      command(['cat'], ['$(b)']),
    ),
  );
});

test('reads a braced expansion with a quoted default as one opaque word', () => {
  assert.deepEqual(splitCommands('echo "${x:-y}"', undefined), items({
    kind: 'command',
    words: [{ text: 'echo', isOpaque: false }, { text: '${x:-y}', isOpaque: true }],
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
