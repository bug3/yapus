const reasons = {
  noVerifyCommit: '`git commit --no-verify` skips the commit hooks; a person runs it',
  noVerifyMerge: '`git merge --no-verify` skips the merge hooks; a person runs it',
  noVerifyAm: '`git am --no-verify` skips the commit hooks; a person runs it',
  noVerifyRebase: '`git rebase --no-verify` skips the commit hooks; a person runs it',
  noVerifyPush: '`git push --no-verify` skips the push hooks; a person runs it',
  hooksPath: 'setting `core.hooksPath` skips the hooks yapus relies on; a person does it',
  configWrite: 'this `git config` may skip the hooks yapus relies on; a person runs it',
  aliasConfig: 'a git alias can hide a command the gate refuses; a person sets it',
  cleanRequireForceConfig:
    'setting `clean.requireForce` lets `git clean` delete without `-f`; a person does it',
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
  aliasKeyPrefix: 'alias.',
  cleanRequireForceKey: 'clean.requireforce',
  // The only keys the agent may set with `-c` or `git config`, compared in lower
  // case: whole keys, and the sections any key of which is allowed (`color.`).
  allowedConfigKeys: [
    'core.pager',
    'core.quotepath',
    'core.autocrlf',
    'core.safecrlf',
    'format.pretty',
    'init.defaultbranch',
    'merge.conflictstyle',
    'rebase.autosquash',
    'rebase.autostash',
    'pull.rebase',
    'push.autosetupremote',
    'fetch.prune',
    'status.showuntrackedfiles',
    'diff.renames',
    'diff.colormoved',
    'diff.algorithm',
  ],
  allowedConfigPrefixes: ['pager.', 'color.', 'advice.', 'column.', 'i18n.', 'log.'],
  // Subcommands that put the key after them (`git config set key value`).
  configKeySubcommands: ['set', 'unset'],
  // Subcommands whose arguments the gate must read to judge them.
  opaqueSubcommands: ['merge', 'am', 'rebase'],
  configReadFlags: ['--get', '--get-all', '--get-regexp', '--list', '-l'],
  configReadSubcommands: ['get', 'list'],
  configSectionFlags: ['--remove-section', '--rename-section'],
  configEditFlags: ['-e', '--edit'],
  environmentConfigPrefix: 'GIT_CONFIG',
} as const;
