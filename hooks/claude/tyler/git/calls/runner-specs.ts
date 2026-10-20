// The kinds of program that run a command given to them as words, as a string or as code.
export type RunnerKind =
  | 'shell'
  | 'closedShell'
  | 'evaluator'
  | 'sourcer'
  | 'executor'
  | 'finder'
  | 'interpreter';

export interface RunnerGroup {
  readonly kind: RunnerKind;
  readonly names: readonly string[];
}

// The programs of each kind by their lower-cased name; a program in none of them runs
// nothing the gate must read. A wrapper (`wrapper-specs.ts`) is in none of them.
const RUNNERS: readonly RunnerGroup[] = [
  // Shells whose `-c` string the gate splits again.
  {
    kind: 'shell',
    names: ['bash', 'sh', 'zsh', 'dash', 'ksh', 'mksh', 'yash', 'posh', 'ash'],
  },
  // Shells whose language the gate does not read.
  {
    kind: 'closedShell',
    names: ['fish', 'tcsh', 'csh', 'elvish', 'nu', 'pwsh', 'powershell'],
  },
  // Programs that join their words into one string and run it as shell input.
  { kind: 'evaluator', names: ['eval'] },
  // Programs that read a script and run it in the current shell.
  { kind: 'sourcer', names: ['source', '.'] },
  // Programs that run a command built from a template, on a remote host or in another
  // context, whatever their words.
  {
    kind: 'executor',
    names: [
      'xargs',
      'parallel',
      'watch',
      'ssh',
      'script',
      'flock',
      'busybox',
      'su',
      'runuser',
      'nsenter',
      'unshare',
      'firejail',
      'systemd-run',
      'at',
      'batch',
    ],
  },
  // Programs that run a command only when given one of FIND_ACTIONS.
  { kind: 'finder', names: ['find'] },
  // Programs that run code given inline or on stdin, by one of INLINE_OPTIONS.
  {
    kind: 'interpreter',
    names: [
      'python',
      'python2',
      'python3',
      'perl',
      'ruby',
      'node',
      'nodejs',
      'deno',
      'bun',
      'php',
      'lua',
      'tclsh',
      'osascript',
      'rscript',
      'julia',
    ],
  },
];

// A versioned interpreter name (`python3.12`) and the name it runs as.
const VERSIONED_NAME = /^(python3)\.\d+$/;

// Shell options that take the next word as their value.
const SHELL_VALUED_OPTIONS: readonly string[] = [
  '-o',
  '+o',
  '-O',
  '+O',
  '--rcfile',
  '--init-file',
];

const FIND_ACTIONS: readonly string[] = ['-exec', '-execdir', '-ok', '-okdir'];

// Words that give an interpreter its code inline or on stdin (`-`). A short option
// group counts when it holds one of the letters (`perl -ne`).
const INLINE_OPTIONS: readonly string[] = [
  '-c',
  '-e',
  '-E',
  '-x',
  '--eval',
  '-p',
  '--print',
  '-',
];

// Inline words of one interpreter only.
const OWN_INLINE_OPTIONS: Readonly<Partial<Record<string, readonly string[]>>> = {
  node: ['-r'],
  nodejs: ['-r'],
  deno: ['eval'],
  bun: ['eval'],
  php: ['-r', '-B', '-R'],
};

export const runnerSpecs = {
  runners: RUNNERS,
  versionedName: VERSIONED_NAME,
  shellValuedOptions: SHELL_VALUED_OPTIONS,
  findActions: FIND_ACTIONS,
  inlineOptions: INLINE_OPTIONS,
  ownInlineOptions: OWN_INLINE_OPTIONS,
};
