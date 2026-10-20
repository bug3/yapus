import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type Calls,
  getCalls as getCallsAt,
} from '../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  type Item,
  splitCommands,
} from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function getCalls(items: readonly Item[]): Calls {
  return getCallsAt(items, undefined);
}

function words(...texts: readonly string[]): unknown[] {
  return texts.map((text) => ({ text, isOpaque: false, canSplit: false }));
}

function item(...texts: readonly string[]): Item {
  return {
    kind: 'command',
    words: [...texts].map((text) => ({ text, isOpaque: false, canSplit: false })),
    heredocs: [],
  };
}

function splitItems(line: string): readonly Item[] {
  const split = splitCommands(line, undefined);

  if (split.kind === 'failure') {
    throw new Error(split.reason);
  }

  return split.items;
}

function opaqueItem(...texts: readonly string[]): Item {
  const last = texts.length - 1;

  return {
    kind: 'command',
    words: texts.map((text, index) => ({
      text,
      isOpaque: index === last,
      canSplit: index === last,
    })),
    heredocs: [],
  };
}

function found(
  tool: string,
  call: { words?: unknown[]; configs?: unknown[]; assignments?: string[] },
): unknown {
  return {
    kind: 'calls',
    calls: [{ tool, words: [], configs: [], assignments: [], ...call }],
  };
}

function none(): unknown {
  return { kind: 'calls', calls: [] };
}

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

test('finds a git call and starts words at the subcommand', () => {
  assert.deepEqual(
    getCalls([item('git', 'push', '--force')]),
    found('git', { words: words('push', '--force') }),
  );
});

test('finds a gh call with every word after gh', () => {
  assert.deepEqual(
    getCalls([item('gh', 'pr', 'merge')]),
    found('gh', { words: words('pr', 'merge') }),
  );
});

test('finds git with no subcommand as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git')]), found('git', {}));
});

test('finds git --version as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git', '--version')]), found('git', {}));
});

test('finds git -v as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git', '-v')]), found('git', {}));
});

test('finds git --help with a topic as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git', '--help', 'push')]), found('git', {}));
});

test('finds git -h as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git', '-h')]), found('git', {}));
});

test('finds the git path options as calls with empty words', () => {
  assert.deepEqual(getCalls([item('git', '--exec-path')]), found('git', {}));
  assert.deepEqual(getCalls([item('git', '--html-path')]), found('git', {}));
  assert.deepEqual(getCalls([item('git', '--man-path')]), found('git', {}));
  assert.deepEqual(getCalls([item('git', '--info-path')]), found('git', {}));
});

test('finds git --list-cmds= as a call with empty words', () => {
  assert.deepEqual(getCalls([item('git', '--list-cmds=main')]), found('git', {}));
});

test('refuses git --exec-path with a value', () => {
  assert.deepEqual(
    getCalls([item('git', '--exec-path=/x', 'status')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('finds a call through a quoted literal program word', () => {
  assert.deepEqual(
    getCalls(splitItems('"git" status')),
    found('git', { words: words('status') }),
  );
});

test('ignores a command that is not git or gh', () => {
  assert.deepEqual(getCalls([item('ls', '-l')]), none());
});

test('ignores open and close items', () => {
  assert.deepEqual(getCalls([{ kind: 'open' }, { kind: 'close' }]), none());
});

test('keeps the order of the command items', () => {
  assert.deepEqual(getCalls([item('git', 'a'), item('gh', 'b')]), {
    kind: 'calls',
    calls: [
      { tool: 'git', words: words('a'), configs: [], assignments: [] },
      { tool: 'gh', words: words('b'), configs: [], assignments: [] },
    ],
  });
});

test('skips reserved words', () => {
  assert.deepEqual(
    getCalls([
      item(
        '!',
        'if',
        'then',
        'elif',
        'else',
        'while',
        'until',
        'do',
        'git',
        'x',
      ),
    ]),
    found('git', { words: words('x') }),
  );
});

test('skips time with its -p option', () => {
  assert.deepEqual(
    getCalls([item('time', '-p', 'git', 'x')]),
    found('git', { words: words('x') }),
  );
});

test('records assignments before the program', () => {
  assert.deepEqual(
    getCalls([item('A=1', '_B2=', 'git', 'x')]),
    found('git', { words: words('x'), assignments: ['A', '_B2'] }),
  );
});

test('records an assignment whose value is opaque', () => {
  const opaque: Item = {
    kind: 'command',
    words: [
      { text: 'A=$X', isOpaque: true, canSplit: true },
      { text: 'git', isOpaque: false, canSplit: false },
    ],
    heredocs: [],
  };

  assert.deepEqual(getCalls([opaque]), found('git', { assignments: ['A'] }));
});

test('skips env options and records its assignments', () => {
  assert.deepEqual(
    getCalls([
      item(
        'env',
        '-i',
        '-0',
        '--null',
        '-u',
        'N',
        '--unset=M',
        '-C',
        'd',
        '--',
        'A=1',
        'git',
        'x',
      ),
    ]),
    found('git', { words: words('x'), assignments: ['A'] }),
  );
});

test('skips env long forms with values', () => {
  assert.deepEqual(
    getCalls([
      item(
        'env',
        '--ignore-environment',
        '--unset',
        'N',
        '--chdir',
        'd',
        '--chdir=e',
        'git',
      ),
    ]),
    found('git', {}),
  );
});

test('reads the string of env -S as a command line', () => {
  assert.deepEqual(
    getCalls([item('env', '-S', 'git status')]),
    found('git', { words: words('status') }),
  );
});

test('reads the string of env --split-string=', () => {
  assert.deepEqual(
    getCalls([item('env', '--split-string=git status')]),
    found('git', { words: words('status') }),
  );
});

test('refuses an env option it does not know', () => {
  assert.deepEqual(
    getCalls([item('env', '-x', 'git')]),
    unjudgeable('env option the gate cannot read', false),
  );
});

test('treats command -v as no call', () => {
  assert.deepEqual(getCalls([item('command', '-v', 'git')]), none());
});

test('treats command -V as no call', () => {
  assert.deepEqual(getCalls([item('command', '-V', 'git')]), none());
});

test('skips command and its -p option', () => {
  assert.deepEqual(
    getCalls([item('command', '-p', 'git', 'x')]),
    found('git', { words: words('x') }),
  );
});

test('skips exec with -a NAME, -c and -l', () => {
  assert.deepEqual(
    getCalls([item('exec', '-a', 'n', '-c', '-l', 'git')]),
    found('git', {}),
  );
});

test('skips nohup', () => {
  assert.deepEqual(getCalls([item('nohup', 'git')]), found('git', {}));
});

test('skips nice -n N', () => {
  assert.deepEqual(
    getCalls([item('nice', '-n', '5', 'git')]),
    found('git', {}),
  );
});

test('skips nice -N with digits', () => {
  assert.deepEqual(getCalls([item('nice', '-10', 'git')]), found('git', {}));
});

test('skips nice --adjustment in both forms', () => {
  assert.deepEqual(
    getCalls([item('nice', '--adjustment=5', '--adjustment', '6', 'git')]),
    found('git', {}),
  );
});

test('skips timeout options and the duration', () => {
  assert.deepEqual(
    getCalls([
      item(
        'timeout',
        '-s',
        'KILL',
        '-k',
        '5',
        '--preserve-status',
        '--foreground',
        '-v',
        '--verbose',
        '10',
        'git',
      ),
    ]),
    found('git', {}),
  );
});

test('skips timeout long options with values', () => {
  assert.deepEqual(
    getCalls([item('timeout', '--signal=KILL', '--kill-after=5', '10', 'git')]),
    found('git', {}),
  );
  assert.deepEqual(
    getCalls([
      item('timeout', '--signal', 'KILL', '--kill-after', '5', '10', 'git'),
    ]),
    found('git', {}),
  );
});

test('skips sudo options', () => {
  assert.deepEqual(
    getCalls([
      item('sudo', '-E', '-H', '-n', '-u', 'u', '--user=v', '--', 'git'),
    ]),
    found('git', {}),
  );
});

test('refuses a sudo option it does not know', () => {
  assert.deepEqual(
    getCalls([item('sudo', '-i', 'git')]),
    unjudgeable('sudo option the gate cannot read', false),
  );
});

test('takes the base name of a path as the program', () => {
  assert.deepEqual(
    getCalls([item('/usr/bin/git', 'x')]),
    found('git', { words: words('x') }),
  );
});

test('takes GIT in any case as git', () => {
  assert.deepEqual(getCalls([item('GIT', 'push')]), found('git', { words: words('push') }));
  assert.deepEqual(getCalls([item('Git', 'push')]), found('git', { words: words('push') }));
  assert.deepEqual(
    getCalls([item('/usr/bin/GIT', 'push')]),
    found('git', { words: words('push') }),
  );
});

test('takes GH in any case as gh', () => {
  assert.deepEqual(getCalls([item('GH', 'pr')]), found('gh', { words: words('pr') }));
});

test('takes a dashed git program as git with the rest of the name as subcommand', () => {
  assert.deepEqual(
    getCalls([item('git-push', '--force')]),
    found('git', { words: words('push', '--force') }),
  );
});

test('takes a dashed git program by path and case without reading global options', () => {
  assert.deepEqual(
    getCalls([item('/usr/libexec/git-core/GIT-reset', '-C', 'd')]),
    found('git', { words: words('reset', '-C', 'd') }),
  );
});

test('does not take a name that only ends in git', () => {
  assert.deepEqual(getCalls([item('/usr/bin/digit', 'x')]), none());
});

test('refuses an opaque program word', () => {
  assert.deepEqual(
    getCalls([opaqueItem('$GIT')]),
    unjudgeable('a program name the gate cannot read', true),
  );
});

test('reads git options with values and records -c and --config-env', () => {
  assert.deepEqual(
    getCalls([
      item(
        'git',
        '-C',
        'd',
        '-c',
        'k=v',
        '--config-env',
        'a=B',
        '--config-env=c=D',
        'x',
      ),
    ]),
    found('git', {
      words: words('x'),
      configs: words('k=v', 'a=B', 'c=D'),
    }),
  );
});

test('reads git long options attached with =', () => {
  assert.deepEqual(
    getCalls([
      item(
        'git',
        '--git-dir=g',
        '--work-tree=w',
        '--namespace=n',
        '--super-prefix=s',
        'x',
      ),
    ]),
    found('git', { words: words('x') }),
  );
});

test('reads git long options with a separate value', () => {
  assert.deepEqual(
    getCalls([
      item(
        'git',
        '--git-dir',
        'g',
        '--work-tree',
        'w',
        '--namespace',
        'n',
        '--super-prefix',
        's',
        'x',
      ),
    ]),
    found('git', { words: words('x') }),
  );
});

test('reads git options without values', () => {
  assert.deepEqual(
    getCalls([
      item(
        'git',
        '--no-pager',
        '-P',
        '-p',
        '--paginate',
        '--bare',
        '--literal-pathspecs',
        '--glob-pathspecs',
        '--noglob-pathspecs',
        '--icase-pathspecs',
        '--no-replace-objects',
        '--no-optional-locks',
        '--no-advice',
        'x',
      ),
    ]),
    found('git', { words: words('x') }),
  );
});

test('refuses a git option with a missing value', () => {
  assert.deepEqual(
    getCalls([item('git', '-C')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses an opaque value of git -C', () => {
  assert.deepEqual(
    getCalls([opaqueItem('git', '-C', '$D')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses an opaque value of git -c', () => {
  assert.deepEqual(
    getCalls([opaqueItem('git', '-c', '$K')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses an opaque value of git --config-env', () => {
  assert.deepEqual(
    getCalls([opaqueItem('git', '--config-env=$K')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses an opaque value of git --git-dir', () => {
  assert.deepEqual(
    getCalls([opaqueItem('git', '--git-dir', '$G')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses a git option it does not know', () => {
  assert.deepEqual(
    getCalls([item('git', '--exec-path=x', 'status')]),
    unjudgeable('a git option the gate cannot read', true),
  );
});

test('refuses an opaque git subcommand', () => {
  assert.deepEqual(
    getCalls([opaqueItem('git', '$SUB')]),
    unjudgeable('a git subcommand the gate cannot read', true),
  );
});

test('makes the first unjudgeable command decide the result', () => {
  assert.deepEqual(
    getCalls([item('git', 'a'), item('sudo', '-i'), opaqueItem('$X')]),
    unjudgeable('sudo option the gate cannot read', false),
  );
});

test('finds the calls of a split line through every wrapper', () => {
  const line =
    'if git push --force; then sudo -u x env -i A=1 nice -n 5 timeout -s KILL 10 /usr/bin/git -C d -c k=v --no-pager reset --hard; fi';

  assert.deepEqual(getCalls(splitItems(line)), {
    kind: 'calls',
    calls: [
      {
        tool: 'git',
        words: words('push', '--force'),
        configs: [],
        assignments: [],
      },
      {
        tool: 'git',
        words: words('reset', '--hard'),
        configs: words('k=v'),
        assignments: ['A'],
      },
    ],
  });
});
