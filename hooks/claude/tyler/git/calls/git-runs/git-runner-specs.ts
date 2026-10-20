// How a git subcommand runs a command: from an option's string (`commandOptions`), from
// its words (`submodule`, `bisect`), through an option naming a program the gate does
// not split (`refusedOptions`), or in ways the gate does not read at all (`refused`).
export type GitRunnerKind =
  | 'commandOptions'
  | 'submodule'
  | 'bisect'
  | 'refusedOptions'
  | 'refused';

// `commandLong` and `valuedLetters` (short options whose value is the rest of their
// group) serve `commandOptions`; `refusedLongs` and `refusedLetters` serve
// `refusedOptions`; `refusal` ends the reason for `refused`, after `git NAME`.
// `isRunningStrings` holds for a subcommand whose words may become a command string, so
// no opaque word is read as one operand.
export interface GitRunner {
  readonly subcommands: readonly string[];
  readonly kind: GitRunnerKind;
  readonly isRunningStrings: boolean;
  readonly commandLong: string;
  readonly valuedLetters: readonly string[];
  readonly refusedLongs: readonly string[];
  readonly refusedLetters: readonly string[];
  readonly refusal: string;
}

const NONE: GitRunner = {
  subcommands: [],
  kind: 'refused',
  isRunningStrings: false,
  commandLong: '',
  valuedLetters: [],
  refusedLongs: [],
  refusedLetters: [],
  refusal: '',
};

const UPLOAD_PACK = '--upload-pack';

const RUNNERS: readonly GitRunner[] = [
  {
    ...NONE,
    subcommands: ['rebase'],
    kind: 'commandOptions',
    isRunningStrings: true,
    commandLong: '--exec',
    valuedLetters: ['s', 'X', 'C'],
  },
  {
    ...NONE,
    subcommands: ['difftool'],
    kind: 'commandOptions',
    isRunningStrings: true,
    commandLong: '--extcmd',
    valuedLetters: ['t'],
  },
  // `git mergetool` takes no command option; its words may still name a tool to run.
  { ...NONE, subcommands: ['mergetool'], kind: 'refusedOptions', isRunningStrings: true },
  { ...NONE, subcommands: ['submodule'], kind: 'submodule', isRunningStrings: true },
  { ...NONE, subcommands: ['bisect'], kind: 'bisect', isRunningStrings: true },
  {
    ...NONE,
    subcommands: ['fetch', 'pull'],
    kind: 'refusedOptions',
    refusedLongs: [UPLOAD_PACK],
  },
  {
    ...NONE,
    subcommands: ['clone', 'ls-remote'],
    kind: 'refusedOptions',
    refusedLongs: [UPLOAD_PACK],
    refusedLetters: ['u'],
  },
  {
    ...NONE,
    subcommands: ['fetch-pack'],
    kind: 'refusedOptions',
    refusedLongs: [UPLOAD_PACK, '--exec'],
  },
  {
    ...NONE,
    subcommands: ['push'],
    kind: 'refusedOptions',
    refusedLongs: ['--receive-pack', '--exec'],
  },
  {
    ...NONE,
    subcommands: ['archive'],
    kind: 'refusedOptions',
    refusedLongs: ['--exec', UPLOAD_PACK],
  },
  {
    ...NONE,
    subcommands: ['grep'],
    kind: 'refusedOptions',
    refusedLongs: ['--open-files-in-pager'],
    refusedLetters: ['O'],
  },
  {
    ...NONE,
    subcommands: ['filter-branch'],
    refusal: 'runs commands and rewrites history the gate cannot read',
  },
  {
    ...NONE,
    subcommands: ['send-email'],
    refusal: 'runs commands and sends mail the gate cannot read',
  },
  {
    ...NONE,
    subcommands: ['for-each-repo'],
    refusal: 'runs git commands in repositories the gate cannot read',
  },
];

// The short option letter that gives `git rebase` and `git difftool` a command.
const COMMAND_LETTER = 'x';

// The options `git submodule foreach` takes before its command.
const FOREACH_OPTIONS: readonly string[] = ['--recursive', '--quiet', '-q'];

export const gitRunnerSpecs = {
  runners: RUNNERS,
  commandLetter: COMMAND_LETTER,
  foreachOptions: FOREACH_OPTIONS,
};
