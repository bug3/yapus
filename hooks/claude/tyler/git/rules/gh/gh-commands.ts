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

const MAX_ISSUE_TITLE = 72;

const COMMENT_ACTIONS = ['pr comment', 'issue comment', 'pr review'] as const;

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

const issueCreate: ActionSpec = {
  command: 'gh issue create',
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
  ],
};

const issueEdit: ActionSpec = {
  command: 'gh issue edit',
  source: 'gh v2.102.0 pkg/cmd/issue/edit/edit.go (flags) and `gh pr edit --help` (--attach)',
  options: [
    { long: 'add-assignee', kind: 'value' },
    { long: 'add-blocked-by', kind: 'value' },
    { long: 'add-blocking', kind: 'value' },
    { long: 'add-label', kind: 'value' },
    { long: 'add-project', kind: 'value' },
    { long: 'add-sub-issue', kind: 'value' },
    { long: 'attach', kind: 'value' },
    { long: 'body', short: 'b', kind: 'value' },
    { long: 'body-file', short: 'F', kind: 'value' },
    { long: 'milestone', short: 'm', kind: 'value' },
    { long: 'parent', kind: 'value' },
    { long: 'remove-assignee', kind: 'value' },
    { long: 'remove-blocked-by', kind: 'value' },
    { long: 'remove-blocking', kind: 'value' },
    { long: 'remove-label', kind: 'value' },
    { long: 'remove-milestone', kind: 'flag' },
    { long: 'remove-parent', kind: 'flag' },
    { long: 'remove-project', kind: 'value' },
    { long: 'remove-sub-issue', kind: 'value' },
    { long: 'remove-type', kind: 'flag' },
    { long: 'title', short: 't', kind: 'value' },
    { long: 'type', kind: 'value' },
    REPO,
  ],
};

// The options the three comment actions share.
const COMMENT_OPTIONS: readonly OptionSpec[] = [
  { long: 'body', short: 'b', kind: 'value' },
  { long: 'body-file', short: 'F', kind: 'value' },
  REPO,
];

const prComment: ActionSpec = {
  command: 'gh pr comment',
  source: 'gh 2.102 `gh pr comment --help`',
  options: [
    ...COMMENT_OPTIONS,
    { long: 'attach', kind: 'value' },
    { long: 'create-if-none', kind: 'flag' },
    { long: 'delete-last', kind: 'flag' },
    { long: 'edit-last', kind: 'flag' },
    { long: 'editor', short: 'e', kind: 'flag' },
    { long: 'web', short: 'w', kind: 'flag' },
    { long: 'yes', kind: 'flag' },
  ],
};

const issueComment: ActionSpec = {
  command: 'gh issue comment',
  source: 'gh 2.102 `gh issue comment --help`',
  options: prComment.options,
};

const prReview: ActionSpec = {
  command: 'gh pr review',
  source: 'gh 2.102 `gh pr review --help`',
  options: [
    ...COMMENT_OPTIONS,
    { long: 'approve', short: 'a', kind: 'flag' },
    { long: 'comment', short: 'c', kind: 'flag' },
    { long: 'request-changes', short: 'r', kind: 'flag' },
  ],
};

const prMerge: ActionSpec = {
  command: 'gh pr merge',
  source: 'gh v2.102.0 pkg/cmd/pr/merge/merge.go',
  options: [
    { long: 'admin', kind: 'flag' },
    { long: 'auto', kind: 'flag' },
    { long: 'author-email', short: 'A', kind: 'value' },
    { long: 'body', short: 'b', kind: 'value' },
    { long: 'body-file', short: 'F', kind: 'value' },
    { long: 'delete-branch', short: 'd', kind: 'flag' },
    { long: 'disable-auto', kind: 'flag' },
    { long: 'match-head-commit', kind: 'value' },
    { long: 'merge', short: 'm', kind: 'flag' },
    { long: 'rebase', short: 'r', kind: 'flag' },
    { long: 'squash', short: 's', kind: 'flag' },
    { long: 'subject', short: 't', kind: 'value' },
    REPO,
  ],
};

const prReady: ActionSpec = {
  command: 'gh pr ready',
  source: 'gh v2.102.0 pkg/cmd/pr/ready/ready.go:62 (--undo) and `gh pr ready --help` (-R)',
  options: [
    { long: 'undo', kind: 'flag' },
    REPO,
  ],
};

// The options of `gh api` that take a value.
const API_VALUE_OPTIONS: readonly { readonly long: string; readonly short?: string }[] = [
  { long: 'cache' },
  { long: 'field', short: 'F' },
  { long: 'header', short: 'H' },
  { long: 'hostname' },
  { long: 'input' },
  { long: 'jq', short: 'q' },
  { long: 'method', short: 'X' },
  { long: 'preview', short: 'p' },
  { long: 'raw-field', short: 'f' },
  { long: 'template', short: 't' },
];

export const ghCommands = {
  // The known gh commands (known-commands.ts) with no action word: the word after
  // one is an operand or an option of its own (`gh copilot` passes its flags on).
  // Every other gh command has subcommands, and the gate reads the second word as one.
  actionlessCommands: [
    'api', 'browse', 'co', 'completion', 'copilot', 'help', 'licenses', 'status', 'version',
  ],
  // Spellings of an action that gh treats as another.
  aliases: new Map([['pr new', 'pr create'], ['issue new', 'issue create']]),
  actions: new Map([
    ['pr create', prCreate],
    ['pr edit', prEdit],
    ['issue create', issueCreate],
    ['issue edit', issueEdit],
    ['pr merge', prMerge],
    ['pr ready', prReady],
    ['pr comment', prComment],
    ['issue comment', issueComment],
    ['pr review', prReview],
  ]),
  // `gh pr merge` deletes the branch and makes a merge commit or, when the repository
  // setting allows it, a squash commit: exactly one of the `kinds` must be on, the
  // `required` flags must be on, and the `forbidden` ones must not be.
  merge: {
    kinds: ['merge', 'squash'],
    required: ['delete-branch'],
    forbidden: ['admin', 'rebase', 'auto', 'disable-auto'],
    // The git config key (a bool, set by a person) that lets a squash merge pass.
    squashSetting: 'yapus.allowSquashMerge',
  },
  // Actions judged against the directory and repository the line starts in: each is
  // the one command of its line (as is any call that reads a body file), `unlessFlag`
  // when the action does not need it with that flag on.
  ownLine: {
    actions: ['pr create', 'pr merge'],
    unlessFlag: new Map([['pr ready', 'undo']]),
  },
  // What `gh api` and `gh label` write with, read by words. The options of `gh api`
  // that take a value (gh v2.102.0 pkg/cmd/api/api.go; its only flag with a short
  // name is `-i`), so that a value is never read as an option.
  writes: {
    readMethod: 'GET',
    methodOption: 'method',
    fieldOptions: ['field', 'raw-field', 'input'],
    apiValueOptions: API_VALUE_OPTIONS,
    graphqlOperand: 'graphql',
    labelActions: ['create', 'edit', 'delete', 'clone'],
  },
  // An issue title is `<scope>: <symptom>`, at most this many characters.
  maxIssueTitle: MAX_ISSUE_TITLE,
  // Options that take the title or the body from somewhere the gate cannot read.
  forbiddenOptions: [
    'body', 'editor', 'web', 'fill', 'fill-first', 'fill-verbose', 'template', 'recover',
  ],
  bodies: {
    pr: {
      headings: ['Summary', 'Test plan'],
      footer: ['Built with yapus', 'Co-authored-by: yapus <noreply@yapus.dev>'],
    },
    // By the kind of the issue, which follows its `type:` label (`issueKinds`).
    issue: new Map<string, BodyRules>([
      ['bug', {
        headings: ['Summary', 'Steps to reproduce', 'Expected', 'Actual', 'Environment'],
        footer: [],
      }],
      ['feature', { headings: ['Summary', 'Why'], footer: [] }],
      ['other', { headings: ['Summary'], footer: [] }],
    ]),
  },
  // The kind of an issue by its type; any type not listed has the fallback kind.
  issueKinds: {
    byType: new Map([['fix', 'bug'], ['feat', 'feature']]),
    fallback: 'other',
  },
  // The actions that add text to an existing pull request or issue. Their
  // `--body` is read by the gate, so it is no forbidden option; these two are
  // (an editor or a browser is where the gate cannot read the text).
  comments: {
    actions: COMMENT_ACTIONS,
    forbiddenOptions: ['editor', 'web'],
  },
  // The options whose text goes through the secret scanner, by action: the title
  // and the body file of a create or edit (`--body` is forbidden there), the body
  // and the body file of a comment or review.
  scanned: new Map<string, readonly string[]>([
    ['pr create', ['title', 'body-file']],
    ['pr edit', ['title', 'body-file']],
    ['issue create', ['title', 'body-file']],
    ['issue edit', ['title', 'body-file']],
    ...COMMENT_ACTIONS.map(
      (action): [string, readonly string[]] => [action, ['body', 'body-file']],
    ),
  ]),
  // The option that uploads a file; no action that has it may use it.
  attachOption: 'attach',
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
    ownLine: (action: string): string =>
      `run \`gh ${ action }\` on a line of its own; the gate judges it against the `
      + 'directory and repository the line starts in',
    optionBeforeAction: (command: string): string =>
      `the word after \`gh ${ command }\` is an option or cannot be read, so the gate cannot `
      + `tell the action; put gh options after \`gh ${ command } <action>\``,
    forbiddenOption: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` takes its text from where the gate cannot read it; `
      + 'give --title and --body-file with an absolute path',
    commentForbiddenOption: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` takes its text from where the gate cannot read it; `
      + 'give --body or --body-file with an absolute path',
    attachUpload: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` uploads a file the gate cannot read; a person attaches it`,
    scanSecret: (rule: string, line: number): string =>
      `the text holds a secret (${ rule }, line ${ String(line) }); remove it; `
      + 'stop and tell the person',
    scanFailed: 'cannot scan the text; retry it',
    scanMissing: 'the secret scanner is not installed; the text was not scanned',
    literalValue: (command: string, what: string): string =>
      `the ${ what } of \`${ command }\` is not literal; write the ${ what } literally, `
      + 'the gate reads it',
    missingOption: (command: string, shown: string): string =>
      `\`${ command }\` needs ${ shown }; write it`,
    apiMethod: '`gh api` with a method other than GET writes on GitHub; a person runs it',
    apiFields: '`gh api` with a field or input option and no method posts; '
      + 'add -X GET to read, or a person runs it',
    apiGraphql: '`gh api graphql` posts every query and mutation; a person runs it',
    apiExpansion: '`gh api` has an argument that starts with an expansion, which could be a '
      + 'method or a field; write it literally',
    labelWrite: (action: string): string =>
      `\`gh label ${ action }\` changes labels outside the catalog; `
      + 'a person runs the sync program hooks/shared/labels/sync-labels.ts',
    labelList: (command: string, option: string): string =>
      `the --${ option } of \`${ command }\` is not a label list gh reads as the gate does `
      + '(a line break, or quotes that do not pair); write the labels plain or in double quotes',
    mergeForbidden: (command: string, shown: string): string =>
      `\`${ command } --${ shown }\` is not a plain merge; use --merge (or --squash where `
      + 'the repository allows it) and --delete-branch only',
    mergeKind: (command: string): string =>
      `\`${ command }\` needs exactly one of --merge and --squash; write it`,
    squashOff: 'squash merges are off here; a person turns them on with '
      + 'yapus.allowSquashMerge',
    squashSettingUnreadable: (detail: string): string =>
      `cannot read yapus.allowSquashMerge (${ detail }); retry it`,
    mergeMoving: (command: string, shown: string): string =>
      `\`${ command }\` is judged against this directory's repository, so ${ shown } `
      + 'is not allowed; remove it',
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
      + 'besides any hand-kept extra label; fix --label',
    issueTitle: (command: string, title: string): string =>
      `the title ${ JSON.stringify(title) } of \`${ command }\` must be \`<scope>: <symptom>\`, `
      + 'a scope from hooks/shared/catalogs/scopes.json, a symptom, and at most '
      + `${ String(MAX_ISSUE_TITLE) } characters; rewrite it`,
    issueLabels: (command: string, scope: string): string =>
      `the labels of \`${ command }\` must be exactly one \`type: <type>\` label and `
      + `\`scope: ${ scope }\`, as its title says, plus any hand-kept extra label and never `
      + '`breaking-change`; fix --label',
    issueEditLabels: (command: string): string =>
      `the labels \`${ command }\` adds must be at most one \`type: <type>\` label, at most `
      + 'one `scope:` label equal to the scope of its title, and never `breaking-change`; '
      + 'fix --add-label',
    editBodyKinds: (command: string, kinds: readonly string[]): string =>
      `the body file of \`${ command }\` must follow one issue kind (${ kinds.join(', ') }); `
      + 'fix the file',
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
