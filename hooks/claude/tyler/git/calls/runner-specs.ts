// The programs that run a command given to them as words or as a string.
const SHELLS: readonly string[] = ['bash', 'sh', 'zsh', 'dash', 'ksh'];

// Shell options that take the next word as their value.
const SHELL_VALUED_OPTIONS: readonly string[] = [
  '-o',
  '+o',
  '-O',
  '+O',
  '--rcfile',
  '--init-file',
];

// Programs that join their words into one string and run it as shell input.
const EVALUATORS: readonly string[] = ['eval'];

// Programs that read a script and run it in the current shell.
const SOURCERS: readonly string[] = ['source', '.'];

// Executors that also run a shell given among their words (`xargs sh -c '{}'`).

// Programs that run a command among their words; `nohup` is a wrapper instead.
const EXECUTORS: readonly string[] = [
  'xargs',
  'watch',
  'parallel',
  'find',
  'setsid',
  'stdbuf',
  'doas',
  'script',
  'ssh',
  'builtin',
  'chroot',
  'flock',
  'ionice',
  'taskset',
  'caffeinate',
  'unbuffer',
];

export const runnerSpecs = {
  shells: SHELLS,
  shellValuedOptions: SHELL_VALUED_OPTIONS,
  sourcers: SOURCERS,
  evaluators: EVALUATORS,
  executors: EXECUTORS,
};
