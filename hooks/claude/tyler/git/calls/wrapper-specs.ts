// The programs that run another program, and the options the gate can read for each.
export interface WrapperSpec {
  readonly name: string;
  readonly flags: readonly string[];
  readonly valued: readonly string[];
  readonly attached: readonly string[];
  readonly hasDigitFlag: boolean;
  readonly extraWords: number;
  // Options after which the command runs nothing (`command -v`).
  readonly ends: readonly string[];
  // Option prefixes the gate refuses to read, with the reason it gives.
  readonly rejected: readonly string[];
  readonly rejectedReason: string;
}

const NONE: WrapperSpec = {
  name: '',
  flags: [],
  valued: [],
  attached: [],
  hasDigitFlag: false,
  extraWords: 0,
  ends: [],
  rejected: [],
  rejectedReason: '',
};

const WRAPPERS: readonly WrapperSpec[] = [
  {
    ...NONE,
    name: 'env',
    flags: ['-i', '-0', '--ignore-environment', '--null', '--'],
    valued: ['-u', '--unset', '-C', '--chdir'],
    attached: ['--unset=', '--chdir='],
    rejected: ['-S', '--split-string'],
    rejectedReason: 'env -S is not read yet',
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
  'time',
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

// Options whose value must be readable, because it can change what git runs.
const GIT_CHECKED_OPTIONS: readonly string[] = [
  '-C',
  '-c',
  '--config-env',
];

export const wrapperSpecs = {
  wrappers: WRAPPERS,
  reservedWords: RESERVED_WORDS,
  gitValuedOptions: GIT_VALUED_OPTIONS,
  gitFlagOptions: GIT_FLAG_OPTIONS,
  gitCheckedOptions: GIT_CHECKED_OPTIONS,
};
