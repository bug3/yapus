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
  template: 'a `--template` directory installs hooks the gate cannot read; a person runs it',
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
  // Keys that pull in another configuration file: `include.path` and
  // `includeIf.<condition>.path`.
  includeKey: 'include.path',
  includeIfPrefix: 'includeif.',
  includeIfSuffix: '.path',
  // The only keys the agent may set with `-c` or `git config`, compared in lower
  // case: whole keys, and the sections any key of which is allowed (`color.`).
  allowedConfigKeys: [
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
  allowedConfigPrefixes: ['color.', 'advice.', 'column.', 'i18n.', 'log.'],
  // Subcommands that put the key after them (`git config set key value`).
  configKeySubcommands: ['set', 'unset'],
  // Subcommands whose arguments the gate must read to judge them.
  opaqueSubcommands: ['merge', 'am', 'rebase'],
  configReadFlags: ['--get', '--get-all', '--get-regexp', '--list', '-l'],
  configReadSubcommands: ['get', 'list'],
  // Options and subcommands refused whatever their operands: a section rename or
  // removal, and an editor.
  configRefusedFlags: ['--remove-section', '--rename-section', '-e', '--edit'],
  configRefusedSubcommands: ['rename-section', 'remove-section', 'edit'],
  // The options of `git config` on git 2.56 (`git config <subcommand> -h`), each
  // matched whole or by an unambiguous prefix; any other option is refused. Those
  // that take a value take the next word unless written with `=`.
  configValueOptions: ['--file', '--blob', '--type', '--value', '--url', '--default', '--comment'],
  configValueLetters: 'ft',
  configFlagOptions: [
    '--global', '--system', '--local', '--worktree', '--all', '--regexp', '--fixed-value',
    '--null', '--name-only', '--show-origin', '--show-scope', '--show-names', '--bool',
    '--int', '--bool-or-int', '--bool-or-str', '--path', '--expiry-date', '--includes',
    '--append', '--get', '--get-all', '--get-regexp', '--get-urlmatch', '--replace-all',
    '--add', '--unset', '--unset-all', '--rename-section', '--remove-section', '--list',
    '--edit', '--get-color', '--get-colorbool',
  ],
  configFlagLetters: 'zle',
  // A write takes at most `key value [value-pattern]`.
  maxConfigWriteOperands: 3,
  environmentConfigPrefix: 'GIT_CONFIG',
  // Subcommands whose `--template`, whole or cut to a prefix, copies hooks in.
  templateSubcommands: ['clone', 'init', 'init-db'],
  templateOption: '--template',
  // `git clone -c key=value` and `--config key=value` set config in the new repository:
  // the long option, whole or cut to a prefix, the short letter, and the letters of the
  // other short options that take a value.
  cloneConfigOption: '--config',
  cloneConfigLetter: 'c',
  cloneValueLetters: 'obuj',
} as const;
