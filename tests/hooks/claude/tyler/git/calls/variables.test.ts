import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCalls } from '../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function callsOf(line: string): unknown {
  const split = splitCommands(line, undefined);

  if (split.kind === 'failure') {
    throw new Error(split.reason);
  }

  return getCalls(split.items, undefined);
}

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const CONFIG = unjudgeable('`GIT_CONFIG*` variables can skip the hooks yapus relies on', false);

const UNREADABLE_NAME = unjudgeable('a variable name the gate cannot read', true);

const NONE = { kind: 'calls', calls: [] };

function gitCall(assignments: readonly string[], ...texts: readonly string[]): unknown {
  return {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
        configs: [],
        assignments,
      },
    ],
  };
}

test('refuses a standalone GIT_CONFIG assignment', () => {
  assert.deepEqual(callsOf('GIT_CONFIG_VALUE_0=/dev/null'), CONFIG);
});

test('refuses a GIT_CONFIG += assignment', () => {
  assert.deepEqual(callsOf('GIT_CONFIG_PARAMETERS+=x'), CONFIG);
});

test('refuses a GIT_CONFIG assignment before a program other than git', () => {
  assert.deepEqual(callsOf('GIT_CONFIG_COUNT=0 make'), CONFIG);
});

test('leaves a GIT_CONFIG assignment before git to the rules', () => {
  assert.deepEqual(
    callsOf('GIT_CONFIG_COUNT=0 git commit'),
    gitCall(['GIT_CONFIG_COUNT'], 'commit'),
  );
});

test('refuses a GIT_CONFIG assignment before gh, which the rules leave alone', () => {
  assert.deepEqual(callsOf('GIT_CONFIG_COUNT=0 gh pr checkout 12'), CONFIG);
});

test('refuses a GIT_CONFIG assignment in a string split again', () => {
  assert.deepEqual(callsOf('eval GIT_CONFIG_COUNT=0'), CONFIG);
});

test('refuses an export of a GIT_CONFIG assignment', () => {
  assert.deepEqual(callsOf('export A=1 GIT_CONFIG_COUNT=1'), CONFIG);
});

test('refuses an export of a GIT_CONFIG name alone', () => {
  assert.deepEqual(callsOf('export GIT_CONFIG_PARAMETERS'), CONFIG);
});

test('refuses declare of a GIT_CONFIG variable without -x', () => {
  assert.deepEqual(callsOf('declare GIT_CONFIG_GLOBAL=x'), CONFIG);
});

test('refuses typeset of a GIT_CONFIG variable', () => {
  assert.deepEqual(callsOf('typeset -g GIT_CONFIG_GLOBAL=x'), CONFIG);
});

test('refuses local of a GIT_CONFIG variable', () => {
  assert.deepEqual(callsOf('local GIT_CONFIG_GLOBAL=x'), CONFIG);
});

test('refuses readonly of a GIT_CONFIG variable', () => {
  assert.deepEqual(callsOf('readonly GIT_CONFIG_GLOBAL=x'), CONFIG);
});

test('refuses unset of a GIT_CONFIG variable', () => {
  assert.deepEqual(callsOf('unset GIT_CONFIG_COUNT'), CONFIG);
});

test('refuses env -u of a GIT_CONFIG variable before git', () => {
  assert.deepEqual(callsOf('env -u GIT_CONFIG_COUNT git commit'), CONFIG);
});

test('refuses env -u attached to a GIT_CONFIG name', () => {
  assert.deepEqual(callsOf('env -uGIT_CONFIG_COUNT git commit'), CONFIG);
});

test('refuses env --unset= of a GIT_CONFIG name', () => {
  assert.deepEqual(callsOf('env --unset=GIT_CONFIG_COUNT git commit'), CONFIG);
});

test('refuses an env assignment whose name is opaque', () => {
  assert.deepEqual(
    callsOf('env "$n=0" git commit'),
    unjudgeable('a wrapper argument the gate cannot read', true),
  );
});

test('refuses an env assignment whose name is opaque after another assignment', () => {
  assert.deepEqual(callsOf('env A=1 "$n=0" git commit'), UNREADABLE_NAME);
});

test('refuses arch -d of a GIT_CONFIG variable before git', () => {
  assert.deepEqual(callsOf('arch -d GIT_CONFIG_COUNT git commit -m x'), CONFIG);
});

test('does not call an export of another variable', () => {
  assert.deepEqual(callsOf('export GIT_AUTHOR_NAME=x'), NONE);
});

test('does not call unset of another variable', () => {
  assert.deepEqual(callsOf('unset FOO'), NONE);
});

test('refuses an export whose variable name is opaque', () => {
  assert.deepEqual(callsOf('export $v'), UNREADABLE_NAME);
});

test('refuses an unset whose quoted variable name is opaque', () => {
  assert.deepEqual(callsOf('unset "$v"'), UNREADABLE_NAME);
});

test('does not call an export whose value only is opaque', () => {
  assert.deepEqual(callsOf('export PATH="$HOME/bin:$PATH"'), NONE);
});

test('passes a program variable set to true before git', () => {
  assert.deepEqual(
    callsOf('GIT_EDITOR=true git rebase --continue'),
    gitCall(['GIT_EDITOR'], 'rebase', '--continue'),
  );
});

test('passes a pager set to cat before git', () => {
  assert.deepEqual(callsOf('PAGER=cat git diff'), gitCall(['PAGER'], 'diff'));
});

test('passes an empty program variable', () => {
  assert.deepEqual(callsOf('GIT_PAGER= git log'), gitCall(['GIT_PAGER'], 'log'));
});

test('refuses a program variable set to a program', () => {
  assert.deepEqual(
    callsOf('GIT_SEQUENCE_EDITOR=vim git rebase -i HEAD~2'),
    unjudgeable('GIT_SEQUENCE_EDITOR names a program the gate cannot read', false),
  );
});

test('refuses a program variable set to an opaque value', () => {
  assert.deepEqual(
    callsOf('GIT_SSH_COMMAND="$c" git fetch'),
    unjudgeable('GIT_SSH_COMMAND names a program the gate cannot read', false),
  );
});

test('refuses a standalone program variable assignment', () => {
  assert.deepEqual(
    callsOf('EDITOR=vim'),
    unjudgeable('EDITOR names a program the gate cannot read', false),
  );
});

test('refuses an export of a program variable', () => {
  assert.deepEqual(
    callsOf('export GIT_PAGER=less'),
    unjudgeable('GIT_PAGER names a program the gate cannot read', false),
  );
});

test('refuses a program variable set through env', () => {
  assert.deepEqual(
    callsOf('env GIT_EXTERNAL_DIFF=x git diff'),
    unjudgeable('GIT_EXTERNAL_DIFF names a program the gate cannot read', false),
  );
});

test('refuses a program variable set through arch -e', () => {
  assert.deepEqual(
    callsOf('arch -e PAGER=less git log'),
    unjudgeable('PAGER names a program the gate cannot read', false),
  );
});

const PAGER = unjudgeable('PAGER names a program the gate cannot read', false);

test('refuses a GIT_CONFIG name as a for loop variable', () => {
  assert.deepEqual(callsOf('for GIT_CONFIG_COUNT in 0; do :; done'), CONFIG);
});

test('refuses a GIT_CONFIG name in let', () => {
  assert.deepEqual(callsOf('let GIT_CONFIG_COUNT=0'), CONFIG);
});

test('refuses a GIT_CONFIG name inside (( ))', () => {
  assert.deepEqual(callsOf('(( GIT_CONFIG_COUNT = 0 ))'), CONFIG);
});

test('refuses a GIT_CONFIG name read from stdin', () => {
  assert.deepEqual(callsOf('read GIT_CONFIG_COUNT'), CONFIG);
});

test('refuses a GIT_CONFIG name set by printf -v', () => {
  assert.deepEqual(callsOf('printf -v GIT_CONFIG_COUNT 0'), CONFIG);
});

test('refuses a value that names a GIT_CONFIG variable', () => {
  assert.deepEqual(callsOf('typeset r=GIT_CONFIG_COUNT'), CONFIG);
});

test('refuses a GIT_CONFIG name where an identifier starts inside a word', () => {
  assert.deepEqual(callsOf('echo x=GIT_CONFIG_COUNT'), CONFIG);
});

test('refuses GIT_CONFIG inside a longer word', () => {
  assert.deepEqual(callsOf('printf -vGIT_CONFIG_COUNT 0'), CONFIG);
});

test('refuses a GIT_TEMPLATE_DIR assignment before git', () => {
  assert.deepEqual(
    callsOf('GIT_TEMPLATE_DIR=/tmp/t git clone url'),
    unjudgeable('GIT_TEMPLATE_DIR names hooks the gate cannot read', false),
  );
});

test('refuses a GIT_TEMPLATE_DIR export even with an empty value', () => {
  assert.deepEqual(
    callsOf('export GIT_TEMPLATE_DIR='),
    unjudgeable('GIT_TEMPLATE_DIR names hooks the gate cannot read', false),
  );
});

test('refuses a program variable name alone', () => {
  assert.deepEqual(callsOf('read PAGER'), PAGER);
});

test('refuses a program variable set by printf -v', () => {
  assert.deepEqual(callsOf('printf -vPAGER less'), PAGER);
});

test('refuses a program variable appended to', () => {
  assert.deepEqual(callsOf('PAGER+=x'), PAGER);
});

test('refuses a program variable indexed', () => {
  assert.deepEqual(callsOf("'PAGER[0]=less'"), PAGER);
});

test('refuses a program variable incremented in arithmetic', () => {
  assert.deepEqual(callsOf('let PAGER++'), PAGER);
});

test('refuses a nameref target that names a program variable', () => {
  assert.deepEqual(callsOf('r=PAGER'), PAGER);
});

test('refuses declare -n', () => {
  assert.deepEqual(
    callsOf('declare -n r=x'),
    unjudgeable('a nameref the gate cannot follow', false),
  );
});

test('refuses local with -n in a short group', () => {
  assert.deepEqual(
    callsOf('local -rn r=x'),
    unjudgeable('a nameref the gate cannot follow', false),
  );
});

test('does not call declare without -n', () => {
  assert.deepEqual(callsOf('declare -r r=x'), NONE);
});

test('does not refuse a commit message that mentions PAGER in a sentence', () => {
  assert.deepEqual(
    callsOf('git commit -m "set PAGER for the docs"'),
    gitCall([], 'commit', '-m', 'set PAGER for the docs'),
  );
});
