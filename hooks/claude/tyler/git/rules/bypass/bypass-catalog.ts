const reasons = {
  noVerifyCommit: '`git commit --no-verify` skips the commit hooks; a person runs it',
  noVerifyMerge: '`git merge --no-verify` skips the merge hooks; a person runs it',
  noVerifyAm: '`git am --no-verify` skips the commit hooks; a person runs it',
  noVerifyRebase: '`git rebase --no-verify` skips the commit hooks; a person runs it',
  noVerifyPush: '`git push --no-verify` skips the push hooks; a person runs it',
  hooksPath: 'setting `core.hooksPath` skips the hooks yapus relies on; a person does it',
  configWrite: 'this `git config` may skip the hooks yapus relies on; a person runs it',
  configEnvironment: '`GIT_CONFIG*` variables can skip the hooks yapus relies on',
} as const;

export const bypassCatalog = {
  reasons,
  // The subcommands that take `--no-verify`, with the reason to refuse each.
  noVerifyReasons: {
    commit: reasons.noVerifyCommit,
    merge: reasons.noVerifyMerge,
    am: reasons.noVerifyAm,
    rebase: reasons.noVerifyRebase,
    push: reasons.noVerifyPush,
  },
  // `git commit` options that take a value: the letters of the short ones, and
  // the long ones, whose value is the next word unless written with `=`.
  commitValueLetters: 'mFCct',
  commitValueOptions: [
    '--message',
    '--file',
    '--reuse-message',
    '--reedit-message',
    '--author',
    '--date',
    '--template',
    '--fixup',
    '--squash',
    '--cleanup',
    '--trailer',
    '--pathspec-from-file',
  ],
  hooksPathKey: 'core.hookspath',
  configReadFlags: ['--get', '--get-all', '--get-regexp', '--list', '-l'],
  configReadSubcommands: ['get', 'list'],
  configSectionFlags: ['--remove-section', '--rename-section'],
  configEditFlags: ['-e', '--edit'],
  environmentConfigPrefix: 'GIT_CONFIG',
} as const;
