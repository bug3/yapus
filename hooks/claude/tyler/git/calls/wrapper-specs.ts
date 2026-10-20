// The programs that run another program, and the options the gate can read for each.
export interface WrapperSpec {
  readonly name: string;
  readonly flags: readonly string[];
  readonly valued: readonly string[];
  readonly attached: readonly string[];
  readonly hasDigitFlag: boolean;
  // Fixed words between the options and the program (`timeout` DURATION).
  readonly extraWords: number;
  // Whether the program runs a shell when no command follows (`chroot NEWROOT`).
  readonly isShellWhenAlone: boolean;
  // Whether NAME=VALUE words may follow the options before the program (`env`).
  readonly hasAssignments: boolean;
  // Options after which the command runs nothing (`command -v`).
  readonly ends: readonly string[];
  // Options whose value is a string to split again (`env -S`): the value is the next
  // word, or is attached to the option name.
  readonly splitValued: readonly string[];
  readonly splitAttached: readonly string[];
}

const NONE: WrapperSpec = {
  name: '',
  flags: [],
  valued: [],
  attached: [],
  hasDigitFlag: false,
  extraWords: 0,
  isShellWhenAlone: false,
  hasAssignments: false,
  ends: [],
  splitValued: [],
  splitAttached: [],
};

const WRAPPERS: readonly WrapperSpec[] = [
  {
    ...NONE,
    name: 'env',
    hasAssignments: true,
    flags: ['-i', '-0', '--ignore-environment', '--null', '--'],
    valued: ['-u', '--unset', '-C', '--chdir'],
    attached: ['--unset=', '--chdir='],
    splitValued: ['-S', '--split-string'],
    splitAttached: ['-S', '--split-string='],
  },
  { ...NONE, name: 'command', flags: ['-p'], ends: ['-v', '-V'] },
  { ...NONE, name: 'exec', flags: ['-c', '-l'], valued: ['-a'] },
  { ...NONE, name: 'nohup' },
  {
    ...NONE,
    name: 'nice',
    valued: ['-n', '--adjustment'],
    attached: ['--adjustment='],
    hasDigitFlag: true,
  },
  {
    ...NONE,
    name: 'timeout',
    flags: ['--preserve-status', '--foreground', '-v', '--verbose'],
    valued: ['-s', '--signal', '-k', '--kill-after'],
    attached: ['--signal=', '--kill-after='],
    extraWords: 1,
  },
  {
    ...NONE,
    name: 'sudo',
    flags: ['-E', '-H', '-n', '--'],
    valued: ['-u'],
    attached: ['--user='],
  },
  {
    ...NONE,
    name: 'stdbuf',
    valued: ['-i', '-o', '-e'],
    attached: ['--input=', '--output=', '--error=', '-i', '-o', '-e'],
  },
  { ...NONE, name: 'setsid', flags: ['-c', '-f', '-w', '--ctty', '--fork', '--wait'] },
  // `doas -s` runs a shell, so the gate does not know it.
  { ...NONE, name: 'doas', flags: ['-n'], valued: ['-u', '-C'] },
  {
    ...NONE,
    name: 'ionice',
    flags: ['-t'],
    valued: ['-c', '-n', '--class', '--classdata'],
  },
  // `taskset -p` changes a running process and runs no command.
  {
    ...NONE,
    name: 'taskset',
    flags: ['-a', '--all-tasks'],
    ends: ['-p', '--pid'],
    extraWords: 1,
  },
  {
    ...NONE,
    name: 'caffeinate',
    flags: ['-d', '-i', '-m', '-s', '-u'],
    valued: ['-t', '-w'],
  },
  { ...NONE, name: 'unbuffer', flags: ['-p'] },
  { ...NONE, name: 'builtin' },
  {
    ...NONE,
    name: 'time',
    flags: ['-p', '-l', '-h', '-a', '--portability', '--verbose', '--append'],
    valued: ['-o', '--output'],
    attached: ['--output='],
  },
  {
    ...NONE,
    name: 'chroot',
    flags: ['--skip-chdir'],
    attached: ['--userspec=', '--groups='],
    extraWords: 1,
    isShellWhenAlone: true,
  },
];

const RESERVED_WORDS: readonly string[] = [
  '!',
  'if',
  'then',
  'elif',
  'else',
  'while',
  'until',
  'do',
  'coproc',
];

// Options of a git invocation that come before the subcommand.
const GIT_VALUED_OPTIONS: readonly string[] = [
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--super-prefix',
];

const GIT_FLAG_OPTIONS: readonly string[] = [
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
];

export const wrapperSpecs = {
  wrappers: WRAPPERS,
  reservedWords: RESERVED_WORDS,
  gitValuedOptions: GIT_VALUED_OPTIONS,
  gitFlagOptions: GIT_FLAG_OPTIONS,
};
