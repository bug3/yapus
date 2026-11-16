// An option of a gh action: pflag matches a long name exactly (no prefixes) and
// a flag takes no value except `=true` or `=false`.
export interface OptionSpec {
  readonly long: string;
  readonly short?: string;
  readonly kind: 'value' | 'flag';
}

// The options of one gh action, the words that name it after `gh`, and where
// the options were read from.
export interface ActionSpec {
  readonly command: string;
  readonly spellings: readonly string[];
  readonly source: string;
  readonly options: readonly OptionSpec[];
}

// What a body must hold: its `##` headings in order, and the lines it ends with.
export interface BodyRules {
  readonly headings: readonly string[];
  readonly footer: readonly string[];
}

export type IssueKind = 'bug' | 'feature' | 'other';

const MAX_ISSUE_TITLE = 72;

const REPO: OptionSpec = { long: 'repo', short: 'R', kind: 'value' };
const HELP: OptionSpec = { long: 'help', short: 'h', kind: 'flag' };

const prCreate: ActionSpec = {
  command: 'gh pr create',
  spellings: ['pr create', 'pr new'],
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
    HELP,
  ],
};

const issueCreate: ActionSpec = {
  command: 'gh issue create',
  spellings: ['issue create', 'issue new'],
  source: 'gh 2.102 `gh issue create --help`',
  options: [
    { long: 'assignee', short: 'a', kind: 'value' },
    { long: 'attach', kind: 'value' },
    { long: 'blocked-by', kind: 'value' },
    { long: 'blocking', kind: 'value' },
    { long: 'body', short: 'b', kind: 'value' },
    { long: 'body-file', short: 'F', kind: 'value' },
    { long: 'editor', short: 'e', kind: 'flag' },
    { long: 'label', short: 'l', kind: 'value' },
    { long: 'milestone', short: 'm', kind: 'value' },
    { long: 'parent', kind: 'value' },
    { long: 'project', short: 'p', kind: 'value' },
    { long: 'recover', kind: 'value' },
    { long: 'template', short: 'T', kind: 'value' },
    { long: 'title', short: 't', kind: 'value' },
    { long: 'type', kind: 'value' },
    { long: 'web', short: 'w', kind: 'flag' },
    REPO,
    HELP,
  ],
};

export const ghCommands = {
  // The actions this check judges; every other gh call passes.
  actions: { prCreate, issueCreate },
  // An issue title is `<scope>: <symptom>`, at most this many characters.
  maxIssueTitle: MAX_ISSUE_TITLE,
  // Options that take the title or the body from somewhere this check cannot read.
  forbiddenOptions: [
    'body', 'editor', 'web', 'fill', 'fill-first', 'fill-verbose', 'template', 'recover',
  ],
  bodies: {
    pr: {
      headings: ['Summary', 'Test plan'],
      footer: ['Built with [yapus](https://yapus.dev)'],
    },
    // By the kind of the issue, which follows its `type:` label (`issueKinds`).
    issue: {
      bug: {
        headings: ['Summary', 'Steps to reproduce', 'Expected', 'Actual', 'Environment'],
        footer: [],
      },
      feature: { headings: ['Summary', 'Why'], footer: [] },
      other: { headings: ['Summary'], footer: [] },
    } satisfies Record<IssueKind, BodyRules>,
  },
  // The kind of an issue by its type; any type not listed has the fallback kind.
  issueKinds: {
    byType: new Map<string, IssueKind>([['fix', 'bug'], ['feat', 'feature']]),
    fallback: 'other' satisfies IssueKind,
  },
  // A body file is read whole, up to this size.
  maxBodyBytes: 65_536,
  readerReasons: {
    unknownOption: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` is not an option this check knows; remove it, or a person `
      + 'runs the command',
    missingValue: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` has no value; write the value after the option`,
    bareEquals: (command: string, shown: string): string =>
      `\`${ command } ${ shown }=\` ends in an equals sign with no value after it; `
      + 'write the value after a space',
    badBoolean: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` takes only true or false; write \`${ shown }=true\``
      + ` or \`${ shown }=false\``,
    expansion: (command: string): string =>
      `\`${ command }\` has an argument that starts with an expansion, which could be any `
      + 'option; write it literally',
  },
  reasons: {
    unreadableCommand: (detail: string): string =>
      `cannot read the command (${ detail }); fix the quoting or the heredoc`,
    forbiddenOption: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` takes its text from where this check cannot read it; `
      + 'give --title and --body-file',
    literalValue: (command: string, what: string): string =>
      `the ${ what } of \`${ command }\` is not literal; write the ${ what } literally, `
      + 'this check reads it',
    missingOption: (command: string, shown: string): string =>
      `\`${ command }\` needs ${ shown }; write it`,
    labelList: (command: string, option: string): string =>
      `the --${ option } of \`${ command }\` is not a label list gh reads as this check does `
      + '(a line break, or quotes that do not pair); write the labels plain or in double quotes',
    title: (command: string, violations: readonly string[]): string =>
      `the title of \`${ command }\` breaks the subject rule: ${ violations.join('; ') }; `
      + 'rewrite it',
    unknownLabel: (command: string, label: string): string =>
      `\`${ command }\` names the label ${ JSON.stringify(label) }, which is not in the label `
      + 'catalog; use a label the catalog labels.json lists',
    titleLabels: (command: string, expected: readonly string[]): string =>
      `the type, scope and breaking-change labels of \`${ command }\` must be exactly `
      + `${ expected.map((label) => `\`${ label }\``).join(', ') }, as its title says, `
      + 'besides any hand-kept extra label; fix --label',
    issueTitle: (command: string, title: string): string =>
      `the title ${ JSON.stringify(title) } of \`${ command }\` must be \`<scope>: <symptom>\`, `
      + 'a scope the catalog scopes.json lists, a symptom, and at most '
      + `${ String(MAX_ISSUE_TITLE) } characters; rewrite it`,
    issueLabels: (command: string, scope: string): string =>
      `the labels of \`${ command }\` must be exactly one \`type: <type>\` label and `
      + `\`scope: ${ scope }\`, as its title says, plus any hand-kept extra label and never `
      + '`breaking-change`; fix --label',
    bodyFileStdin: (command: string): string =>
      `the --body-file of \`${ command }\` is standard input, which this check cannot read; `
      + 'write the body to a file and give its path',
    bodyFileUnknownCwd: (command: string, path: string): string =>
      `the --body-file ${ JSON.stringify(path) } of \`${ command }\` is relative to a directory `
      + 'this check cannot tell; give an absolute --body-file',
    bodyFileMissing: (path: string): string =>
      `${ path } does not exist yet; write the file first, then run the command`,
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

export type GhAction = keyof typeof ghCommands.actions;
