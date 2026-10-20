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

function call(...texts: readonly string[]): unknown {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const REBASE_ARGUMENT = unjudgeable(
  'cannot judge `git rebase` with an argument that may run a command; write it literally',
  true,
);

const SUBMODULE_ARGUMENT = unjudgeable(
  'cannot judge `git submodule` with an argument that may run a command; write it literally',
  true,
);

const BISECT_ARGUMENT = unjudgeable(
  'cannot judge `git bisect` with an argument that may run a command; write it literally',
  true,
);

test('reads the command of git rebase -x', () => {
  assert.deepEqual(callsOf("git rebase -x 'git push -f' HEAD"), {
    kind: 'calls',
    calls: [call('rebase', '-x', 'git push -f', 'HEAD'), call('push', '-f')],
  });
});

test('reads every command of git rebase --exec and --exec=', () => {
  assert.deepEqual(callsOf("git rebase --exec 'git a' --exec='git b' HEAD"), {
    kind: 'calls',
    calls: [call('rebase', '--exec', 'git a', '--exec=git b', 'HEAD'), call('a'), call('b')],
  });
});

test('reads the command attached to git rebase -x', () => {
  assert.deepEqual(callsOf("git rebase -x'git a' HEAD"), {
    kind: 'calls',
    calls: [call('rebase', '-xgit a', 'HEAD'), call('a')],
  });
});

test('refuses an opaque command of git rebase -x', () => {
  assert.deepEqual(callsOf('git rebase -x "x$c" HEAD'), REBASE_ARGUMENT);
});

test('reads the words of git submodule foreach as a command and as a joined string', () => {
  assert.deepEqual(callsOf('git submodule foreach --recursive --quiet git reset --hard'), {
    kind: 'calls',
    calls: [
      call('submodule', 'foreach', '--recursive', '--quiet', 'git', 'reset', '--hard'),
      call('reset', '--hard'),
      call('reset', '--hard'),
    ],
  });
});

test('reads a shell string run by git submodule foreach as argv', () => {
  assert.deepEqual(callsOf("git submodule foreach bash -c 'git push -f'"), {
    kind: 'calls',
    calls: [
      call('submodule', 'foreach', 'bash', '-c', 'git push -f'),
      call('push', '-f'),
      call(),
    ],
  });
});

test('refuses an opaque word in the command of git submodule foreach', () => {
  assert.deepEqual(callsOf('git submodule foreach "x$c"'), SUBMODULE_ARGUMENT);
});

test('reads the words after git bisect run as a command and as a joined string', () => {
  assert.deepEqual(callsOf('git bisect run git reset --hard'), {
    kind: 'calls',
    calls: [
      call('bisect', 'run', 'git', 'reset', '--hard'),
      call('reset', '--hard'),
      call('reset', '--hard'),
    ],
  });
});

test('reads one quoted word after git bisect run as a shell string', () => {
  assert.deepEqual(callsOf("git bisect run 'git reset --hard'"), {
    kind: 'calls',
    calls: [call('bisect', 'run', 'git reset --hard'), call('reset', '--hard')],
  });
});

test('reads the joined words of git bisect run as a shell string', () => {
  assert.deepEqual(callsOf("git bisect run echo 'x; git reset --hard'"), {
    kind: 'calls',
    calls: [call('bisect', 'run', 'echo', 'x; git reset --hard'), call('reset', '--hard')],
  });
});

test('refuses an opaque program after git bisect run', () => {
  assert.deepEqual(callsOf('git bisect run "x$c"'), BISECT_ARGUMENT);
});

test('reads the command of git difftool --extcmd=', () => {
  assert.deepEqual(callsOf("git difftool --extcmd='git a'"), {
    kind: 'calls',
    calls: [call('difftool', '--extcmd=git a'), call('a')],
  });
});

test('does not read git mergetool -x as a command, which mergetool does not take', () => {
  assert.deepEqual(callsOf("git mergetool -x 'git a'"), {
    kind: 'calls',
    calls: [call('mergetool', '-x', 'git a')],
  });
});

test('refuses a quoted opaque word of git mergetool', () => {
  assert.deepEqual(
    callsOf('git mergetool "$f"'),
    unjudgeable(
      'cannot judge `git mergetool` with an argument that may run a command; write it literally',
      true,
    ),
  );
});

test('refuses a quoted opaque word of git difftool', () => {
  assert.deepEqual(
    callsOf('git difftool "x$f"'),
    unjudgeable(
      'cannot judge `git difftool` with an argument that may run a command; write it literally',
      true,
    ),
  );
});

test('does not read git difftool --tool-help as a command', () => {
  assert.deepEqual(callsOf('git difftool --tool-help'), {
    kind: 'calls',
    calls: [call('difftool', '--tool-help')],
  });
});

test('refuses git filter-branch', () => {
  assert.deepEqual(
    callsOf('git filter-branch --tree-filter x HEAD'),
    unjudgeable('git filter-branch runs commands and rewrites history the gate cannot read', true),
  );
});

test('counts a git rebase command toward the nesting depth', () => {
  assert.deepEqual(
    callsOf('bash -c "bash -c \'git rebase -x x HEAD\'"'),
    unjudgeable('commands nested too deep', false),
  );
});

test('counts a git bisect run command toward the nesting depth', () => {
  assert.deepEqual(
    callsOf('git bisect run git bisect run git bisect run git status'),
    unjudgeable('commands nested too deep', false),
  );
});

test('reads the command of -x at the end of a short group', () => {
  assert.deepEqual(callsOf("git rebase -ix 'git a' HEAD"), {
    kind: 'calls',
    calls: [call('rebase', '-ix', 'git a', 'HEAD'), call('a')],
  });
});

test('reads no command from a short option whose value holds x', () => {
  assert.deepEqual(callsOf('git rebase -sxgit HEAD'), {
    kind: 'calls',
    calls: [call('rebase', '-sxgit', 'HEAD')],
  });
});

test('reads the command of a long option cut to a prefix', () => {
  assert.deepEqual(callsOf("git rebase --exe='git a' HEAD"), {
    kind: 'calls',
    calls: [call('rebase', '--exe=git a', 'HEAD'), call('a')],
  });
});

test('refuses a command run by git that the gate cannot split', () => {
  assert.deepEqual(
    callsOf('git rebase -x \'echo "\' HEAD'),
    unjudgeable('unterminated double quote', true),
  );
});

test('refuses git fetch --upload-pack', () => {
  assert.deepEqual(
    callsOf('git fetch --upload-pack=x origin'),
    unjudgeable('git fetch runs a command the gate cannot read', true),
  );
});

test('refuses git clone -u, its upload-pack', () => {
  assert.deepEqual(
    callsOf('git clone -u x url'),
    unjudgeable('git clone runs a command the gate cannot read', true),
  );
});

test('does not refuse git fetch -u, which updates the head', () => {
  assert.deepEqual(callsOf('git fetch -u origin'), {
    kind: 'calls',
    calls: [call('fetch', '-u', 'origin')],
  });
});

test('refuses git push --receive-pack cut to a prefix', () => {
  assert.deepEqual(
    callsOf('git push --receive=x'),
    unjudgeable('git push runs a command the gate cannot read', true),
  );
});

test('refuses git archive --exec', () => {
  assert.deepEqual(
    callsOf('git archive --exec=x --remote=r HEAD'),
    unjudgeable('git archive runs a command the gate cannot read', true),
  );
});

test('refuses git grep -O', () => {
  assert.deepEqual(
    callsOf('git grep -O foo'),
    unjudgeable('git grep runs a command the gate cannot read', true),
  );
});

const SPLIT_ARGUMENT = unjudgeable('a git argument the gate cannot read may run a command', true);

test('refuses a splittable word before git submodule foreach', () => {
  assert.deepEqual(callsOf('git submodule $X foreach true'), SUBMODULE_ARGUMENT);
});

test('refuses a splittable word before git bisect run', () => {
  assert.deepEqual(callsOf('git bisect $X run true'), BISECT_ARGUMENT);
});

test('refuses a splittable word in git rebase arguments', () => {
  assert.deepEqual(callsOf('git rebase $opts HEAD'), REBASE_ARGUMENT);
});

test('refuses a quoted word of git rebase that starts with an expansion', () => {
  assert.deepEqual(callsOf('git rebase "$base"'), REBASE_ARGUMENT);
});

test('refuses a quoted opaque word of git rebase with a literal start', () => {
  assert.deepEqual(callsOf('git rebase "origin/$b"'), REBASE_ARGUMENT);
});

test('refuses a quoted word that starts with an expansion before git bisect run', () => {
  assert.deepEqual(callsOf('git bisect "$X" run true'), BISECT_ARGUMENT);
});

test('reads a quoted opaque word of git push as one operand', () => {
  assert.deepEqual(callsOf('git push origin "$b"'), {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: [
          { text: 'push', isOpaque: false, canSplit: false },
          { text: 'origin', isOpaque: false, canSplit: false },
          { text: '$b', isOpaque: true, canSplit: false },
        ],
        configs: [],
        assignments: [],
      },
    ],
  });
});

test('reads a splittable word after a literal -- of git grep as an operand', () => {
  assert.deepEqual(callsOf('git grep TODO -- *.ts'), {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: [
          { text: 'grep', isOpaque: false, canSplit: false },
          { text: 'TODO', isOpaque: false, canSplit: false },
          { text: '--', isOpaque: false, canSplit: false },
          { text: '*.ts', isOpaque: true, canSplit: true },
        ],
        configs: [],
        assignments: [],
      },
    ],
  });
});

test('refuses a splittable word before a literal -- of git grep', () => {
  assert.deepEqual(callsOf('git grep $p -- x'), SPLIT_ARGUMENT);
});

test('refuses a splittable word after a literal -- of git submodule foreach', () => {
  assert.deepEqual(callsOf('git submodule foreach -- x$c'), SUBMODULE_ARGUMENT);
});

test('refuses a git submodule foreach option it does not know', () => {
  assert.deepEqual(
    callsOf('git submodule foreach -x git push -f'),
    unjudgeable('a git submodule foreach option the gate cannot read', true),
  );
});

test('reads the command of git submodule foreach after -q and --', () => {
  assert.deepEqual(callsOf('git submodule -q foreach -q -- git a'), {
    kind: 'calls',
    calls: [call('submodule', '-q', 'foreach', '-q', '--', 'git', 'a'), call('a'), call('a')],
  });
});

test('refuses git fetch-pack --upload-pack cut to a prefix', () => {
  assert.deepEqual(
    callsOf('git fetch-pack --upload=x url'),
    unjudgeable('git fetch-pack runs a command the gate cannot read', true),
  );
});

test('refuses git fetch-pack --exec', () => {
  assert.deepEqual(
    callsOf('git fetch-pack --exec=x url'),
    unjudgeable('git fetch-pack runs a command the gate cannot read', true),
  );
});

test('refuses git send-email', () => {
  assert.deepEqual(
    callsOf('git send-email x.patch'),
    unjudgeable('git send-email runs commands and sends mail the gate cannot read', true),
  );
});

test('refuses git for-each-repo', () => {
  assert.deepEqual(
    callsOf('git for-each-repo --config=x gc'),
    unjudgeable('git for-each-repo runs git commands in repositories the gate cannot read', true),
  );
});
