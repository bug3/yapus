const REMOTE = 'refs/remotes/origin/';

// The size of the pull request a `gh pr create` opens, measured in the working
// directory against the base branch on origin.
export const sizeCatalog = {
  // Lines changed (additions plus deletions, generated files left out) above which
  // the gate notes the size, and above which it refuses.
  noteAbove: 400,
  refuseAbove: 1000,
  // Files that are not counted, by basename.
  lockfiles: [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'Cargo.lock',
    'go.sum', 'poetry.lock', 'uv.lock', 'Gemfile.lock', 'composer.lock',
  ],
  // Files whose attribute has one of these values are not counted either.
  generatedAttribute: 'linguist-generated',
  generatedValues: ['set', 'true'],
  // Keeps the machine's system attributes file out of the reading.
  attributesEnv: { GIT_ATTR_NOSYSTEM: '1' },
  // A `--base` value is a branch name written plainly.
  basePattern: /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/,
  remote: REMOTE,
  // How git older than 2.42 answers `--attr-source` and `check-attr --source`: an
  // unknown option, exit 129 with the usage.
  oldGit: { status: 129, stderr: /unknown option/ },
  // Options that move the pull request away from the directory that is measured.
  movingOptions: ['repo', 'head'],
  reasons: {
    moving: (command: string, shown: string): string =>
      `the size of \`${ command }\` is measured in this directory and branch, so ${ shown } `
      + 'is not allowed; remove it',
    badBase: (command: string, base: string): string =>
      `the --base of \`${ command }\` is ${ JSON.stringify(base) }; write a plain branch name`,
    noBase: (command: string): string =>
      `\`${ command }\` needs --base; give --base <branch>`,
    fetchFirst: (ref: string): string =>
      `cannot find ${ ref }; fetch origin first`,
    unpushed: (command: string): string =>
      `\`${ command }\` opens the pull request for the branch as pushed, and HEAD is not `
      + 'what its upstream holds (no upstream, a detached HEAD, or a different commit); '
      + 'push the branch first, then open the pull request',
    cannotMeasure: (detail: string): string =>
      `cannot measure the pull request (${ detail }); retry it`,
    oldGit: 'the size check of `gh pr create` needs git 2.42 or newer; a person upgrades git',
    localAttributes: (path: string): string =>
      `cannot measure the pull request: ${ path } changes how git counts lines; `
      + 'a person removes it or opens the pull request',
    tooBig: (command: string, lines: number, limit: number): string =>
      `\`${ command }\` changes ${ String(lines) } lines, over ${ String(limit) }; split it`,
    big: (lines: number, limit: number): string =>
      `This pull request changes ${ String(lines) } lines, over ${ String(limit) }. `
      + 'Reviewers lose track of a change this size; consider splitting it.',
  },
} as const;
