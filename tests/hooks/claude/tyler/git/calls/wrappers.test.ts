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

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const UNREADABLE = {
  kind: 'unjudgeable',
  reason: 'a wrapper argument the gate cannot read',
  shouldAlwaysDeny: true,
};

const NONE = { kind: 'calls', calls: [] };

const APPENDS = {
  kind: 'unjudgeable',
  reason: 'xargs appends arguments the gate cannot read',
  shouldAlwaysDeny: false,
};

test('treats a path to env as a wrapper', () => {
  assert.deepEqual(callsOf('/usr/bin/env A=1 git push'), gitCall(['A'], 'push'));
});

test('treats a wrapper in upper case as a wrapper', () => {
  assert.deepEqual(callsOf('NOHUP git push'), gitCall([], 'push'));
});

test('refuses an opaque value of nice -n', () => {
  assert.deepEqual(callsOf('nice -n $N git push'), UNREADABLE);
});

test('refuses an opaque timeout duration', () => {
  assert.deepEqual(callsOf('timeout $D git push'), UNREADABLE);
});

test('refuses an opaque value of sudo -u', () => {
  assert.deepEqual(callsOf('sudo -u $U git push'), UNREADABLE);
});

test('refuses an opaque value of env -u', () => {
  assert.deepEqual(callsOf('env -u $X git push'), UNREADABLE);
});

test('refuses an opaque word where the program starts after a wrapper', () => {
  assert.deepEqual(callsOf('sudo $CMD push'), UNREADABLE);
});

test('refuses an opaque program word after the timeout duration', () => {
  assert.deepEqual(callsOf('timeout 10 $CMD push'), UNREADABLE);
});

test('refuses an opaque program word after env assignments', () => {
  assert.deepEqual(callsOf('env A=1 $CMD push'), UNREADABLE);
});

test('allows an assignment with an opaque value after a wrapper', () => {
  assert.deepEqual(callsOf('nohup A="$X" git push'), gitCall(['A'], 'push'));
});

test('refuses an assignment with a splittable value after a wrapper', () => {
  assert.deepEqual(callsOf('nohup A=$X git push'), UNREADABLE);
});

test('refuses an env assignment with a splittable value', () => {
  assert.deepEqual(callsOf('env A=$X git commit -m x'), UNREADABLE);
});

test('reads an env assignment with a quoted opaque value', () => {
  assert.deepEqual(callsOf('env A="$X" git status'), gitCall(['A'], 'status'));
});

test('records an append assignment', () => {
  assert.deepEqual(callsOf('A+=x git push'), gitCall(['A'], 'push'));
});

test('records an indexed assignment', () => {
  assert.deepEqual(callsOf('A[1]=x git push'), gitCall(['A'], 'push'));
});

test('records an env assignment whose name is not a plain name', () => {
  assert.deepEqual(callsOf('env 1x=y git push'), gitCall(['1x'], 'push'));
});

test('records an env append assignment by its name', () => {
  assert.deepEqual(callsOf("env A+=x 'B[1]=y' git push"), gitCall(['A', 'B'], 'push'));
});

test('refuses an env word with an opaque name before the equals sign', () => {
  assert.deepEqual(callsOf('env $N=1 git push'), UNREADABLE);
});

test('skips coproc', () => {
  assert.deepEqual(callsOf('coproc git push'), gitCall([], 'push'));
});

test('skips stdbuf with an attached mode', () => {
  assert.deepEqual(callsOf('stdbuf -oL git reset --hard'), gitCall([], 'reset', '--hard'));
});

test('skips stdbuf modes with separate and long values', () => {
  assert.deepEqual(
    callsOf('stdbuf -i 0 -o L -e 0 -iL -o0 -eL --input=0 --output=L --error=0 git push'),
    gitCall([], 'push'),
  );
});

test('reads env -S behind stdbuf', () => {
  assert.deepEqual(callsOf("stdbuf env -S 'git push'"), gitCall([], 'push'));
});

test('reads a shell string behind stdbuf', () => {
  assert.deepEqual(callsOf("stdbuf -oL sh -c 'git push'"), gitCall([], 'push'));
});

test('skips setsid options', () => {
  assert.deepEqual(
    callsOf('setsid -c -f -w --ctty --fork --wait git push'),
    gitCall([], 'push'),
  );
});

test('skips doas options', () => {
  assert.deepEqual(callsOf('doas -n -u root -C /etc/doas.conf git push'), gitCall([], 'push'));
});

test('refuses doas -s, which runs a shell', () => {
  assert.deepEqual(callsOf('doas -s'), unjudgeable('doas option the gate cannot read', false));
});

test('skips ionice options', () => {
  assert.deepEqual(
    callsOf('ionice -c 2 -n 7 -t --class 3 --classdata 1 git push'),
    gitCall([], 'push'),
  );
});

test('skips the taskset mask', () => {
  assert.deepEqual(callsOf('taskset 0x1 git push'), gitCall([], 'push'));
});

test('skips taskset -a and the mask', () => {
  assert.deepEqual(callsOf('taskset --all-tasks 0x1 git push'), gitCall([], 'push'));
});

test('treats taskset -p as no call', () => {
  assert.deepEqual(callsOf('taskset -p 1'), NONE);
});

test('skips caffeinate options', () => {
  assert.deepEqual(
    callsOf('caffeinate -d -i -m -s -u -t 60 -w 1 git push'),
    gitCall([], 'push'),
  );
});

test('skips unbuffer -p', () => {
  assert.deepEqual(callsOf('unbuffer -p git push'), gitCall([], 'push'));
});

test('reads eval behind builtin', () => {
  assert.deepEqual(callsOf('builtin eval git push'), gitCall([], 'push'));
});

test('refuses a builtin option', () => {
  assert.deepEqual(
    callsOf('builtin -x git push'),
    unjudgeable('builtin option the gate cannot read', false),
  );
});

test('skips the time program by its path', () => {
  assert.deepEqual(callsOf('/usr/bin/time -p git push'), gitCall([], 'push'));
});

test('skips the time program in upper case', () => {
  assert.deepEqual(callsOf('TIME git push'), gitCall([], 'push'));
});

test('skips the time program options', () => {
  assert.deepEqual(
    callsOf(
      'time -l -h -a -o f --portability --verbose --append --output f --output=f git push',
    ),
    gitCall([], 'push'),
  );
});

test('skips the chroot root', () => {
  assert.deepEqual(callsOf('chroot /x git push'), gitCall([], 'push'));
});

test('skips chroot options and the root', () => {
  assert.deepEqual(
    callsOf('chroot --userspec=u:g --groups=g --skip-chdir /x git push'),
    gitCall([], 'push'),
  );
});

test('refuses chroot without a command, which runs a shell', () => {
  assert.deepEqual(
    callsOf('chroot /x'),
    unjudgeable('chroot runs a shell the gate cannot read', false),
  );
});

test('reads the command after xargs', () => {
  assert.deepEqual(
    callsOf('git diff --name-only | xargs wc -l'),
    gitCall([], 'diff', '--name-only'),
  );
});

test('refuses git behind xargs, which appends arguments', () => {
  assert.deepEqual(callsOf('xargs git branch -D'), APPENDS);
});

test('refuses git behind a wrapper behind xargs', () => {
  assert.deepEqual(callsOf('xargs sudo git push'), APPENDS);
});

test('refuses a runner behind xargs', () => {
  assert.deepEqual(callsOf('xargs bash'), APPENDS);
});

test('skips xargs flags and valued options', () => {
  assert.deepEqual(callsOf('xargs -0 -r -t -n 1 -P 4 -d x -a f bash'), APPENDS);
});

test('skips xargs attached and long valued options', () => {
  assert.deepEqual(
    callsOf('xargs -n1 -L2 --max-args=1 --max-procs=2 --delimiter=x --eof=y bash'),
    APPENDS,
  );
});

test('refuses xargs that replaces arguments', () => {
  assert.deepEqual(
    callsOf('xargs -I{} git push -f {}'),
    unjudgeable('xargs replaces arguments the gate cannot read', false),
  );
});

test('refuses xargs --replace', () => {
  assert.deepEqual(
    callsOf('xargs --replace git push'),
    unjudgeable('xargs replaces arguments the gate cannot read', false),
  );
});

test('does not call xargs without a command, which runs echo', () => {
  assert.deepEqual(callsOf('xargs -0'), NONE);
});

test('refuses an xargs option it does not know', () => {
  assert.deepEqual(
    callsOf('xargs -q git push'),
    unjudgeable('xargs option the gate cannot read', false),
  );
});

test('reads the command after noglob', () => {
  assert.deepEqual(callsOf('noglob git push'), gitCall([], 'push'));
});

test('reads the command after nocorrect', () => {
  assert.deepEqual(callsOf('nocorrect git push'), gitCall([], 'push'));
});

test('reads the command after repeat and its count', () => {
  assert.deepEqual(callsOf('repeat 3 git push'), gitCall([], 'push'));
});

test('refuses an opaque repeat count', () => {
  assert.deepEqual(callsOf('repeat $n git push'), UNREADABLE);
});

test('reads the command after arch and its options', () => {
  assert.deepEqual(
    callsOf('arch -arm64 -d B -arch x86_64 git push'),
    gitCall([], 'push'),
  );
});

test('records the variable that arch -e sets', () => {
  assert.deepEqual(
    callsOf('arch -e GIT_CONFIG_COUNT=1 git push'),
    gitCall(['GIT_CONFIG_COUNT'], 'push'),
  );
});

test('refuses an opaque value of arch -e', () => {
  assert.deepEqual(callsOf('arch -e "$v" git push'), UNREADABLE);
});

test('reads the command after xcrun and its options', () => {
  assert.deepEqual(callsOf('xcrun --sdk macosx -v git push'), gitCall([], 'push'));
});

test('does not call xcrun --find', () => {
  assert.deepEqual(callsOf('xcrun --find git'), NONE);
});

test('does not call xcrun --show-sdk-path', () => {
  assert.deepEqual(callsOf('xcrun --show-sdk-path'), NONE);
});

test('reads the command after xcrun --find and -r', () => {
  assert.deepEqual(
    callsOf('xcrun --find x -r git push --force'),
    gitCall([], 'push', '--force'),
  );
});

test('reads the command after xcrun --show-sdk-path', () => {
  assert.deepEqual(callsOf('xcrun --show-sdk-path git push'), gitCall([], 'push'));
});

test('refuses xargs followed by a wrapper with no program, read from stdin', () => {
  assert.deepEqual(callsOf('echo git push -f | xargs env'), APPENDS);
});

test('refuses xargs followed by a wrapper with options and no program', () => {
  assert.deepEqual(callsOf('echo git push -f | xargs nice -n 5'), APPENDS);
});

test('does not call xargs with nothing after its options, which runs echo', () => {
  assert.deepEqual(callsOf('echo git push -f | xargs -0'), NONE);
});
