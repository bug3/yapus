// An option of a gh action: pflag matches a long name exactly (no prefixes) and
// a flag takes no value except `=true` or `=false`.
export interface OptionSpec {
  readonly long: string;
  readonly short?: string;
  readonly kind: 'value' | 'flag';
}

// The options of one gh action, with where they were read from.
export interface ActionSpec {
  readonly command: string;
  readonly source: string;
  readonly options: readonly OptionSpec[];
}

// What a body must hold: its `##` headings in order, and the lines it ends with.
export interface BodyRules {
  readonly headings: readonly string[];
  readonly footer: readonly string[];
}

const REPO: OptionSpec = { long: 'repo', short: 'R', kind: 'value' };

const prCreate: ActionSpec = {
  command: 'gh pr create',
  source: 'gh 2.102 `gh pr create --help`',
  options: [
    { long: 'assignee', short: 'a', kind: 'value' },
    { long: 'attach', kind: 'value' },
    { long: 'base', short: 'B', kind: 'value' },
    { long: 'body', short: 'b', kind: 'value' },
    { long: 'body-file', short: 'F', kind: 'value' },
    { long: 'draft', short: 'd', kind: 'flag' },
    { long: 'dry-run', kind: 'flag' },
    { long: 'editor', short: 'e', kind: 'flag' },
    { long: 'fill', short: 'f', kind: 'flag' },
    { long: 'fill-first', kind: 'flag' },
    { long: 'fill-verbose', kind: 'flag' },
    { long: 'head', short: 'H', kind: 'value' },
    { long: 'label', short: 'l', kind: 'value' },
    { long: 'milestone', short: 'm', kind: 'value' },
    { long: 'no-maintainer-edit', kind: 'flag' },
    { long: 'project', short: 'p', kind: 'value' },
    { long: 'recover', kind: 'value' },
    { long: 'reviewer', short: 'r', kind: 'value' },
    { long: 'template', short: 'T', kind: 'value' },
    { long: 'title', short: 't', kind: 'value' },
    { long: 'web', short: 'w', kind: 'flag' },
    REPO,
  ],
};

const prEdit: ActionSpec = {
  command: 'gh pr edit',
  source: 'gh 2.102 `gh pr edit --help`',
  options: [
    { long: 'add-assignee', kind: 'value' },
    { long: 'add-label', kind: 'value' },
    { long: 'add-project', kind: 'value' },
    { long: 'add-reviewer', kind: 'value' },
    { long: 'attach', kind: 'value' },
    { long: 'base', short: 'B', kind: 'value' },
    { long: 'body', short: 'b', kind: 'value' },
    { long: 'body-file', short: 'F', kind: 'value' },
    { long: 'milestone', short: 'm', kind: 'value' },
    { long: 'remove-assignee', kind: 'value' },
    { long: 'remove-label', kind: 'value' },
    { long: 'remove-milestone', kind: 'flag' },
    { long: 'remove-project', kind: 'value' },
    { long: 'remove-reviewer', kind: 'value' },
    { long: 'title', short: 't', kind: 'value' },
    REPO,
  ],
};

export const ghCommands = {
  // The known gh commands (known-commands.ts) with no action word: the word after
  // one is an operand or an option of its own (`gh copilot` passes its flags on).
  // Every other gh command has subcommands, and the gate reads the second word as one.
  actionlessCommands: [
    'api', 'browse', 'co', 'completion', 'copilot', 'help', 'licenses', 'status', 'version',
  ],
  // Spellings of an action that gh treats as another.
  aliases: new Map([['pr new', 'pr create']]),
  actions: new Map([['pr create', prCreate], ['pr edit', prEdit]]),
  // Options that take the title or the body from somewhere the gate cannot read.
  forbiddenOptions: [
    'body', 'editor', 'web', 'fill', 'fill-first', 'fill-verbose', 'template', 'recover',
  ],
  bodies: {
    pr: {
      headings: ['Summary', 'Test plan'],
      footer: ['Built with yapus', 'Co-authored-by: yapus <noreply@yapus.dev>'],
    },
  },
  // A body file is read whole, up to this size.
  maxBodyBytes: 65_536,
  readerReasons: {
    unknownOption: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` is not an option the gate knows; a person runs it`,
    missingValue: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` has no value; write the value after the option`,
    bareEquals: (command: string, shown: string): string =>
      `\`${ command } ${ shown }=\` ends in an equals sign with no value after it; `
      + 'write the value after a space',
    badBoolean: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` takes only true or false; write \`${ shown }=true\``
      + ` or \`${ shown }=false\``,
  },
  reasons: {
    bodyLine: (action: string): string =>
      `run \`gh ${ action }\` on a line of its own, after the body file is written; `
      + 'the gate reads the body file before the line runs',
    optionBeforeAction: (command: string): string =>
      `the word after \`gh ${ command }\` is an option or cannot be read, so the gate cannot `
      + `tell the action; put gh options after \`gh ${ command } <action>\``,
    forbiddenOption: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` takes its text from where the gate cannot read it; `
      + 'give --title and --body-file with an absolute path',
    literalValue: (command: string, what: string): string =>
      `the ${ what } of \`${ command }\` is not literal; write the ${ what } literally, `
      + 'the gate reads it',
    missingOption: (command: string, shown: string): string =>
      `\`${ command }\` needs ${ shown }; write it`,
    draftOnly: (command: string): string =>
      `\`${ command }\` must open a draft; add --draft`,
    title: (command: string, violations: readonly string[]): string =>
      `the title of \`${ command }\` breaks the subject rule: ${ violations.join('; ') }; `
      + 'rewrite it',
    unknownLabel: (command: string, label: string): string =>
      `\`${ command }\` names the label ${ JSON.stringify(label) }, which is not in the label `
      + 'catalog; use a label from hooks/shared/catalogs',
    titleLabels: (command: string, expected: readonly string[]): string =>
      `the type, scope and breaking-change labels of \`${ command }\` must be exactly `
      + `${ expected.map((label) => `\`${ label }\``).join(', ') }, as its title says, `
      + 'and no kind label; fix --label',
    removedTitleLabel: (command: string, label: string): string =>
      `\`${ command } --remove-label\` cannot remove ${ JSON.stringify(label) }, which the `
      + 'title says; change the title instead',
    bodyFileNotAbsolute: (command: string, path: string): string =>
      `the --body-file of \`${ command }\` is ${ JSON.stringify(path) }; `
      + 'write an absolute path to a file, not - or a relative path',
    bodyFileUnreadable: (path: string): string =>
      `cannot read ${ path }; make it a UTF-8 file of at most 64 KiB`,
    bodyHeadings: (headings: readonly string[]): string =>
      `the body must have the \`##\` headings ${ headings.join(', ') } in order, `
      + 'each with text under it; fix the file',
    bodyFooter: (footer: readonly string[]): string =>
      `the body must end with the lines ${ footer.map((line) => `\`${ line }\``).join(' and ') }; `
      + 'add them',
  },
} as const;
