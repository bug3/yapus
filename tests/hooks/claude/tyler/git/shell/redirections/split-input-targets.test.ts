import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  splitCommands,
} from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';
import { CLOSE, item, OPEN, plain, whole } from '../items.ts';

// The input targets of the item at index of the line, whatever the item is.
function targetsOf(line: string, index = 0): unknown {
  const split = splitCommands(line, undefined);
  const found = split.kind === 'items' ? split.items[index] : undefined;

  return found?.kind === 'command'
    ? found.inputTargets
    : split;
}

test('keeps the target of a `<` written without a space', () => {
  assert.deepEqual(targetsOf('cat <.env'), [plain('.env')]);
});

test('keeps the target of a `<` written across a space', () => {
  assert.deepEqual(targetsOf('cat < .env'), [plain('.env')]);
});

test('keeps the target of a `<>`', () => {
  assert.deepEqual(targetsOf('cat <>.env'), [plain('.env')]);
});

test('keeps the target of a `<` after a file descriptor', () => {
  assert.deepEqual(targetsOf('cat 0< .env'), [plain('.env')]);
});

test('keeps every input target of one command in order', () => {
  assert.deepEqual(targetsOf('cat <a <b'), [plain('a'), plain('b')]);
});

test('keeps an opaque target as opaque', () => {
  assert.deepEqual(targetsOf('cat < "$F"'), [whole('$F')]);
});

test('keeps no target for an output redirection', () => {
  assert.deepEqual(targetsOf('echo x > .env'), []);
});

test('keeps no target for a here-string', () => {
  assert.deepEqual(targetsOf('cat <<< .env'), []);
});

test('keeps no target for a heredoc', () => {
  assert.deepEqual(targetsOf('cat <<EOF\n.env\nEOF'), []);
});

test('keeps no target for a descriptor duplication', () => {
  assert.deepEqual(targetsOf('cat <&3'), []);
});

test('keeps the target of a redirection after a subshell as an item with no words', () => {
  assert.deepEqual(splitCommands('( cat ) < .env', undefined), {
    kind: 'items',
    items: [OPEN, item('cat'), CLOSE, {
      kind: 'command',
      words: [],
      heredocs: [],
      hasRedirection: true,
      inputTargets: [plain('.env')],
    }],
  });
});

test('keeps the target of a redirection after a brace group', () => {
  assert.deepEqual(targetsOf('{ cat; } < .env', 1), [plain('.env')]);
});

test('carries no target into the next command', () => {
  assert.deepEqual(targetsOf('cat <a; ls', 1), []);
});
