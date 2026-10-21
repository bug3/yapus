import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  splitCommands,
} from '../../../../../../hooks/claude/tyler/gh/shell/split-commands.ts';

function literal(text: string): { text: string; isLiteral: boolean } {
  return { text, isLiteral: true };
}

test('reads single and double quotes as parts of one literal word', () => {
  assert.deepEqual(splitCommands('echo \'a b\' "c d"e'), {
    commands: [[literal('echo'), literal('a b'), literal('c de')]],
    isolated: [false],
  });
});

test('reads the escapes of double quotes and keeps other backslashes', () => {
  assert.deepEqual(splitCommands('echo "a\\"b\\\\c\\$d\\n"'), {
    commands: [[literal('echo'), literal('a"b\\c$d\\n')]],
    isolated: [false],
  });
});

test('makes a word with an expansion outside single quotes not literal', () => {
  assert.deepEqual(splitCommands('echo "$X" \'$Y\' `z` ~/f'), {
    commands: [[
      literal('echo'),
      { text: '$X', isLiteral: false },
      literal('$Y'),
      { text: '`z`', isLiteral: false },
      { text: '~/f', isLiteral: false },
    ]],
    isolated: [false],
  });
});

test('reads a backslash outside quotes as an escape and a line join', () => {
  assert.deepEqual(splitCommands('echo a\\ b \\\n  c'), {
    commands: [[literal('echo'), literal('a b'), literal('c')]],
    isolated: [false],
  });
});

test('splits on every operator and marks the commands that run apart', () => {
  assert.deepEqual(splitCommands('a; b && c || d | e & f\ng (h)'), {
    commands: [
      [literal('a')], [literal('b')], [literal('c')], [literal('d')], [literal('e')],
      [literal('f')], [literal('g')], [literal('h')],
    ],
    isolated: [false, false, false, true, true, false, false, true],
  });
});

test('drops a comment to the end of its line', () => {
  assert.deepEqual(splitCommands('echo a#b # gh pr create\necho c'), {
    commands: [[literal('echo'), literal('a#b')], [literal('echo'), literal('c')]],
    isolated: [false, false],
  });
});

test('drops redirections, their targets and their file descriptors', () => {
  assert.deepEqual(splitCommands('gh pr create 2>&1 >out <in &>log'), {
    commands: [[literal('gh'), literal('pr'), literal('create')]],
    isolated: [false],
  });
});

test('skips a heredoc body that holds a gh call and an apostrophe', () => {
  assert.deepEqual(splitCommands('cat <<\'EOF\' > b.md\ngh pr create it\'s\nEOF\necho done'), {
    commands: [[literal('cat')], [literal('echo'), literal('done')]],
    isolated: [false, false],
  });
});

test('ends a tab-stripped heredoc at a delimiter line after tabs', () => {
  assert.deepEqual(splitCommands('cat <<-END\n\tit\'s\n\tEND\necho done'), {
    commands: [[literal('cat')], [literal('echo'), literal('done')]],
    isolated: [false, false],
  });
});

test('fails on a quote that is not closed', () => {
  assert.deepEqual(splitCommands('gh pr create --title "feat(x): a'), {
    failure: 'a double quote is not closed',
  });
  assert.deepEqual(splitCommands('echo \'a'), { failure: 'a single quote is not closed' });
});

test('fails on a heredoc with no delimiter line', () => {
  assert.deepEqual(splitCommands('cat <<EOF\nbody'), {
    failure: 'a heredoc has no delimiter line',
  });
});
