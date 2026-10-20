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
      'pypy',
      'jruby',
      'ipython',
    ],
  },
];

// A versioned program name (`python3.12`, `perl5.34`, `node18`) and the name before
// its version; a reader uses that name only when it is a known runner.
const VERSIONED_NAME = /^([a-z]+?)\d+(?:\.\d+)*$/;

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

// Interpreter options whose value is the next word, so that word is not a script file
// (`python3 -W ignore` still reads stdin).
const INTERPRETER_VALUED_OPTIONS: readonly string[] = [
  '-W',
  '-X',
  '-Q',
  '-I',
  '-M',
  '-C',
  '-d',
  '-z',
  '--require',
  '--import',
  '--loader',
  '--conditions',
  '--input-type',
];

// Script operands that name stdin, after `path.posix.normalize`: any device or process
// file may be stdin.
const STDIN_PATHS: readonly string[] = ['-'];
const STDIN_PREFIXES: readonly string[] = ['/dev/', '/proc/'];

// Interpreter options that print information or run tests, so with no script the
// interpreter does not read stdin; the short ones differ by family (`python3 -v` is
// verbose and still reads stdin).
const INTERPRETER_NO_STDIN_OPTIONS: readonly string[] = ['--version', '--help', '--test'];

const OWN_NO_STDIN_OPTIONS: Readonly<Partial<Record<string, readonly string[]>>> = {
  node: ['-v', '-h'],
  nodejs: ['-v', '-h'],
  deno: ['-v', '-h'],
  bun: ['-v', '-h'],
  python: ['-V', '-h'],
  python2: ['-V', '-h'],
  python3: ['-V', '-h'],
  pypy: ['-V', '-h'],
  ipython: ['-V', '-h'],
  perl: ['-v', '-V'],
};

// Interpreter subcommands followed by the script operand (`deno run x.ts`), and those
// that read stdin (`deno repl`).
const OWN_SCRIPT_SUBCOMMANDS: Readonly<Partial<Record<string, readonly string[]>>> = {
  deno: ['run', 'x', 'task'],
  bun: ['run', 'x', 'task'],
};

const OWN_STDIN_SUBCOMMANDS: Readonly<Partial<Record<string, readonly string[]>>> = {
  deno: ['repl'],
  bun: ['repl'],
};

// A word of short options, one letter each, possibly with a value attached (`-xCMD`).
const SHORT_GROUP = /^-[^-]/;

export const runnerSpecs = {
  runners: RUNNERS,
  shortGroup: SHORT_GROUP,
  versionedName: VERSIONED_NAME,
  shellValuedOptions: SHELL_VALUED_OPTIONS,
  findActions: FIND_ACTIONS,
  inlineOptions: INLINE_OPTIONS,
  ownInlineOptions: OWN_INLINE_OPTIONS,
  interpreterValuedOptions: INTERPRETER_VALUED_OPTIONS,
  interpreterNoStdinOptions: INTERPRETER_NO_STDIN_OPTIONS,
  ownNoStdinOptions: OWN_NO_STDIN_OPTIONS,
  ownScriptSubcommands: OWN_SCRIPT_SUBCOMMANDS,
  ownStdinSubcommands: OWN_STDIN_SUBCOMMANDS,
  stdinPaths: STDIN_PATHS,
  stdinPrefixes: STDIN_PREFIXES,
};
