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

function gitCall(...texts: readonly string[]): unknown {
  return {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
        configs: [],
        assignments: [],
      },
    ],
  };
}

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const SCRIPT = 'a shell reading a script or stdin the gate cannot read';

const NONE = { kind: 'calls', calls: [] };
const SPLIT_TEXT = 'env -S text the gate cannot read';

test('reads the string of bash -c', () => {
  assert.deepEqual(callsOf("bash -c 'git reset --hard'"), gitCall('reset', '--hard'));
});

test('reads the string of a combined option group with c', () => {
  assert.deepEqual(callsOf('bash -lc "git push --force"'), gitCall('push', '--force'));
});

test('reads the string after a shell option that takes a value', () => {
  assert.deepEqual(callsOf("bash -o pipefail -c 'git push'"), gitCall('push'));
});

test('refuses a shell string it cannot read', () => {
  assert.deepEqual(
    callsOf('sh -c "$X"'),
    unjudgeable('a shell string the gate cannot read', true),
  );
});

test('refuses a shell string that does not split', () => {
  assert.deepEqual(callsOf("sh -c 'git push)'"), unjudgeable('unmatched )', false));
});

test('does not call a shell that runs a script file by its path', () => {
  assert.deepEqual(callsOf('bash ./build.sh'), NONE);
});

test('refuses a shell given an opaque word, whatever the line says', () => {
  assert.deepEqual(callsOf('bash $ARGS'), unjudgeable(SCRIPT, true));
});

test('does not call a shell that runs a script file', () => {
  assert.deepEqual(callsOf('zsh script.sh'), NONE);
});

test('refuses a shell that reads a pipe', () => {
  assert.deepEqual(callsOf("echo 'git push' | bash"), unjudgeable(SCRIPT, false));
});

test('refuses a shell that reads a heredoc', () => {
  assert.deepEqual(callsOf('bash <<EOF\ngit push\nEOF'), unjudgeable(SCRIPT, false));
});

test('refuses a shell that reads a redirection', () => {
  assert.deepEqual(callsOf('sh < x'), unjudgeable(SCRIPT, false));
});

test('does not call source with a literal file', () => {
  assert.deepEqual(callsOf('source env.sh'), NONE);
});

test('does not call a dot command with a literal file', () => {
  assert.deepEqual(callsOf('. env.sh'), NONE);
});

test('reads env -S as a command line', () => {
  assert.deepEqual(callsOf("env -S 'git push --force'"), gitCall('push', '--force'));
});

test('puts the words after the env -S string behind its words', () => {
  assert.deepEqual(callsOf("env -S 'git push' --force"), gitCall('push', '--force'));
});

test('refuses an env -S string it cannot read', () => {
  assert.deepEqual(
    callsOf('env -S "$X"'),
    unjudgeable(SPLIT_TEXT, true),
  );
});

test('reads eval with bare words', () => {
  assert.deepEqual(callsOf('eval git reset --hard'), gitCall('reset', '--hard'));
});

test('reads eval with one string', () => {
  assert.deepEqual(callsOf('eval "git reset --hard"'), gitCall('reset', '--hard'));
});

test('refuses eval of an opaque value', () => {
  assert.deepEqual(
    callsOf('eval $X'),
    unjudgeable('eval of a value the gate cannot read', true),
  );
});

test('reads two nested strings', () => {
  assert.deepEqual(callsOf('bash -c "bash -c \\"git push\\""'), gitCall('push'));
});

test('refuses a third nested string', () => {
  assert.deepEqual(
    callsOf('bash -c "bash -c \\"bash -c \'git push\'\\""'),
    unjudgeable('commands nested too deep', false),
  );
});

test('reads the string of each shell that takes -c', () => {
  assert.deepEqual(callsOf("mksh -c 'git push'"), gitCall('push'));
  assert.deepEqual(callsOf("yash -c 'git push'"), gitCall('push'));
  assert.deepEqual(callsOf("posh -c 'git push'"), gitCall('push'));
  assert.deepEqual(callsOf("ash -c 'git push'"), gitCall('push'));
  assert.deepEqual(callsOf("dash -c 'git push'"), gitCall('push'));
  assert.deepEqual(callsOf("ksh -c 'git push'"), gitCall('push'));
});

test('refuses fish', () => {
  assert.deepEqual(
    callsOf("fish -c 'git push'"),
    unjudgeable('fish runs a command the gate cannot read', false),
  );
});

test('refuses tcsh', () => {
  assert.deepEqual(
    callsOf('tcsh x'),
    unjudgeable('tcsh runs a command the gate cannot read', false),
  );
});

test('refuses csh', () => {
  assert.deepEqual(
    callsOf('csh'),
    unjudgeable('csh runs a command the gate cannot read', false),
  );
});

test('refuses elvish', () => {
  assert.deepEqual(
    callsOf('elvish x'),
    unjudgeable('elvish runs a command the gate cannot read', false),
  );
});

test('refuses nu', () => {
  assert.deepEqual(
    callsOf('nu -c x'),
    unjudgeable('nu runs a command the gate cannot read', false),
  );
});

test('refuses pwsh', () => {
  assert.deepEqual(
    callsOf('pwsh -Command x'),
    unjudgeable('pwsh runs a command the gate cannot read', false),
  );
});

test('refuses powershell in any case', () => {
  assert.deepEqual(
    callsOf('PowerShell x'),
    unjudgeable('powershell runs a command the gate cannot read', false),
  );
});

test('refuses an opaque program word in a shell string', () => {
  assert.deepEqual(
    callsOf("bash -c '$X push'"),
    unjudgeable('a program name the gate cannot read', true),
  );
});

test('reads env options and assignments in the env -S string', () => {
  assert.deepEqual(callsOf("env -S '-0 A=1 git push'"), {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: [{ text: 'push', isOpaque: false, canSplit: false }],
        configs: [],
        assignments: ['A'],
      },
    ],
  });
});

test('reads the env -S string as words, not as a shell line', () => {
  assert.deepEqual(callsOf("env -S 'git push;'"), gitCall('push;'));
});

test('reads the attached env -S string', () => {
  assert.deepEqual(callsOf("env '-Sgit push'"), gitCall('push'));
});

test('refuses an env -S string with a dollar sign', () => {
  assert.deepEqual(callsOf("env -S 'git push ${X}'"), unjudgeable(SPLIT_TEXT, true));
});

test('refuses an env -S string with a backslash', () => {
  assert.deepEqual(callsOf("env -S 'g\\it push'"), unjudgeable(SPLIT_TEXT, true));
});

test('refuses an env -S string with a quote', () => {
  assert.deepEqual(callsOf('env -S "\'g\'it push"'), unjudgeable(SPLIT_TEXT, true));
});

test('refuses an opaque program word after the env -S string', () => {
  assert.deepEqual(
    callsOf("env -S 'A=1' $X push"),
    unjudgeable('a wrapper argument the gate cannot read', true),
  );
});

test('finds the git call after a shell that runs a script file', () => {
  assert.deepEqual(callsOf('bash ./build.sh && git status'), gitCall('status'));
});

test('refuses a shell whose script operand is opaque, whatever the line says', () => {
  assert.deepEqual(callsOf('bash $SCRIPT'), unjudgeable(SCRIPT, true));
});

test('refuses a shell that reads stdin by -s despite an operand', () => {
  assert.deepEqual(callsOf('bash -s x'), unjudgeable(SCRIPT, false));
});

test('refuses a shell whose option value is opaque, whatever the line says', () => {
  assert.deepEqual(callsOf('bash -o $X x.sh'), unjudgeable(SCRIPT, true));
});

test('finds the git call after source with a literal file', () => {
  assert.deepEqual(callsOf('source .venv/bin/activate && git status'), gitCall('status'));
});

test('refuses source of an opaque file, whatever the line says', () => {
  assert.deepEqual(callsOf('source "$X"'), unjudgeable(SCRIPT, true));
});

test('refuses source of an opaque file after --', () => {
  assert.deepEqual(callsOf('source -- $X'), unjudgeable(SCRIPT, true));
});

test('refuses a shell whose script is /dev/stdin', () => {
  assert.deepEqual(callsOf('bash /dev/stdin'), unjudgeable(SCRIPT, false));
});

test('refuses source of a /proc/self/fd file', () => {
  assert.deepEqual(callsOf('source /proc/self/fd/0'), unjudgeable(SCRIPT, false));
});

test('refuses a dot command of a /dev/fd file', () => {
  assert.deepEqual(callsOf('. /dev/fd/3'), unjudgeable(SCRIPT, false));
});

test('refuses a shell whose script operand is -', () => {
  assert.deepEqual(callsOf('bash -- -'), unjudgeable(SCRIPT, false));
});

test('refuses source without a file', () => {
  assert.deepEqual(callsOf('source'), unjudgeable(SCRIPT, false));
});
