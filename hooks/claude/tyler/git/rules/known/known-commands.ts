// The commands the gate knows. Anything else may be an alias or an extension.
export const knownCommands = {
  // git's porcelain and plumbing commands (`git help -a`), and the extension `lfs`.
  git: [
    'add', 'am', 'annotate', 'apply', 'archive', 'bisect', 'blame', 'branch', 'bundle',
    'cat-file', 'check-attr', 'check-ignore', 'check-mailmap', 'check-ref-format',
    'checkout', 'checkout-index', 'cherry', 'cherry-pick', 'citool', 'clean', 'clone',
    'column', 'commit', 'commit-graph', 'commit-tree', 'config', 'count-objects',
    'credential', 'describe', 'diff', 'diff-files', 'diff-index', 'diff-tree', 'difftool',
    'fast-export', 'fast-import', 'fetch', 'fetch-pack', 'filter-branch', 'fmt-merge-msg',
    'for-each-ref', 'for-each-repo', 'format-patch', 'fsck', 'gc', 'get-tar-commit-id',
    'grep', 'gui', 'hash-object', 'help', 'hook', 'index-pack', 'init',
    'interpret-trailers', 'log', 'ls-files', 'ls-remote', 'ls-tree', 'maintenance',
    'merge', 'merge-base', 'merge-file', 'merge-index', 'merge-tree', 'mergetool', 'mktag',
    'mktree', 'multi-pack-index', 'mv', 'name-rev', 'notes', 'pack-objects',
    'pack-redundant', 'pack-refs', 'patch-id', 'prune', 'prune-packed', 'pull', 'push',
    'range-diff', 'read-tree', 'rebase', 'reflog', 'refs', 'remote', 'repack', 'replace',
    'replay', 'request-pull', 'rerere', 'reset', 'restore', 'rev-list', 'rev-parse',
    'revert', 'rm', 'send-email', 'shortlog', 'show', 'show-branch', 'show-index',
    'show-ref', 'sparse-checkout', 'stash', 'status', 'stripspace', 'submodule', 'switch',
    'symbolic-ref', 'tag', 'unpack-file', 'unpack-objects', 'update-index', 'update-ref',
    'update-server-info', 'var', 'verify-commit', 'verify-pack', 'verify-tag', 'version',
    'whatchanged', 'worktree', 'write-tree', 'lfs',
    // On git 2.56 too; read-only or harmless. `history` (rewrites history) and the
    // transport commands (`send-pack`, `http-push`, ...) stay out.
    'stage', 'repo', 'jump', 'last-modified', 'backfill', 'diff-pairs', 'format-rev',
    'url-parse', 'subtree', 'bugreport', 'diagnose', 'init-db', 'fsck-objects', 'pickaxe',
  ],
  // gh's top-level commands.
  gh: [
    'alias', 'api', 'attestation', 'auth', 'browse', 'cache', 'co', 'codespace',
    'completion', 'config', 'extension', 'gist', 'gpg-key', 'help', 'issue', 'label', 'org',
    'pr', 'preview', 'project', 'release', 'repo', 'ruleset', 'run', 'search', 'secret',
    'ssh-key', 'status', 'variable', 'workflow', 'version',
    // On gh 2.102 too.
    'discussion', 'licenses', 'agent-task', 'copilot', 'skill',
  ],
} satisfies Record<'git' | 'gh', readonly string[]>;
