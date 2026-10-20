import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  bypassCatalog,
} from '../../../../../../../hooks/claude/tyler/git/rules/bypass/bypass-catalog.ts';
import {
  getBypassRefusal,
} from
  '../../../../../../../hooks/claude/tyler/git/rules/bypass/get-bypass-refusal.ts';

function gitCall(...texts: readonly string[]): Call {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function assertUnsettable(call: Call, key: string): void {
  assert.equal(
    getBypassRefusal(call),
    `\`git config\` key \`${ key }\` is not one the agent may set; a person sets it`,
  );
}

function withOpaque(call: Call): Call {
  return { ...call, words: [...call.words, { text: '$X', isOpaque: true, canSplit: true }] };
}

function withQuoted(call: Call): Call {
  return { ...call, words: [...call.words, { text: '$X', isOpaque: true, canSplit: false }] };
}

function withConfig(call: Call, text: string): Call {
  return { ...call, configs: [{ text, isOpaque: false, canSplit: false }] };
}

function withAssignment(call: Call, name: string): Call {
  return { ...call, assignments: [name] };
}

test('refuses git commit --no-verify', () => {
  assert.equal(
    getBypassRefusal(gitCall('commit', '--no-verify', '-m', 'x')),
    bypassCatalog.reasons.noVerifyCommit,
  );
});

test('refuses git commit -n and a group holding n', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '-n')), bypassCatalog.reasons.noVerifyCommit);
  assert.equal(
    getBypassRefusal(gitCall('commit', '-an', '-m', 'x')),
    bypassCatalog.reasons.noVerifyCommit,
  );
});

test('refuses git commit --no-verify written as a prefix', () => {
  assert.equal(
    getBypassRefusal(gitCall('commit', '--no-v')),
    bypassCatalog.reasons.noVerifyCommit,
  );
});

test('refuses git commit --no-verify after a value', () => {
  assert.equal(
    getBypassRefusal(gitCall('commit', '-m', 'x', '--no-verify')),
    bypassCatalog.reasons.noVerifyCommit,
  );
});

test('refuses git commit --no-verify after a long option with a value', () => {
  assert.equal(
    getBypassRefusal(gitCall('commit', '--message=x', '--no-verify')),
    bypassCatalog.reasons.noVerifyCommit,
  );
  assert.equal(
    getBypassRefusal(gitCall('commit', '--message', 'x', '-n')),
    bypassCatalog.reasons.noVerifyCommit,
  );
});

test('refuses git merge, am, rebase and push with --no-verify', () => {
  assert.equal(
    getBypassRefusal(gitCall('merge', '--no-verify')),
    bypassCatalog.reasons.noVerifyMerge,
  );
  assert.equal(getBypassRefusal(gitCall('am', '--no-verify')), bypassCatalog.reasons.noVerifyAm);
  assert.equal(
    getBypassRefusal(gitCall('rebase', '--no-verify', 'main')),
    bypassCatalog.reasons.noVerifyRebase,
  );
  assert.equal(
    getBypassRefusal(gitCall('push', '--no-verify', 'origin')),
    bypassCatalog.reasons.noVerifyPush,
  );
});

test('refuses git push --no-verify written as a prefix', () => {
  assert.equal(getBypassRefusal(gitCall('push', '--no-ver')), bypassCatalog.reasons.noVerifyPush);
});

test('does not read -n as no-verify outside commit', () => {
  assert.equal(getBypassRefusal(gitCall('push', '-n')), undefined);
  assert.equal(getBypassRefusal(gitCall('merge', '-n')), undefined);
});

test('passes a commit message that says no verify', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '-m', 'no verify')), undefined);
});

test('passes a commit message that is a flag', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '-m', '-n')), undefined);
  assert.equal(getBypassRefusal(gitCall('commit', '--message', '--no-verify')), undefined);
  assert.equal(getBypassRefusal(gitCall('commit', '--message=--no-verify')), undefined);
});

test('passes a commit message glued to -m', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '-mn')), undefined);
  assert.equal(getBypassRefusal(gitCall('commit', '-amn')), undefined);
});

test('passes git commit -am', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '-am', 'x')), undefined);
});

test('passes a quoted opaque commit value and never reads it as a flag', () => {
  assert.equal(getBypassRefusal(withQuoted(gitCall('commit', '-m'))), undefined);
  assert.equal(getBypassRefusal(withQuoted(gitCall('commit', '-am'))), undefined);
  assert.equal(getBypassRefusal(withQuoted(gitCall('commit', '--message'))), undefined);
  assert.equal(getBypassRefusal(withOpaque(gitCall('push', 'origin'))), undefined);
});

test('refuses an opaque commit word that is not a value', () => {
  const reason = 'cannot judge `git commit` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +';

  assert.equal(getBypassRefusal(withOpaque(gitCall('commit', '-a'))), reason);
  assert.equal(getBypassRefusal(withOpaque(gitCall('commit', '--', 'x'))), reason);
  assert.equal(
    getBypassRefusal({
      ...gitCall('commit'),
      words: [
        { text: 'commit', isOpaque: false, canSplit: false },
        { text: '$ARGS', isOpaque: true, canSplit: true },
        { text: '-m', isOpaque: false, canSplit: false },
        { text: 'x', isOpaque: false, canSplit: false },
      ],
    }),
    reason,
  );
});

test('refuses a commit value the shell may split, which can bring -n', () => {
  assert.equal(
    getBypassRefusal({
      ...gitCall('commit'),
      words: [
        { text: 'commit', isOpaque: false, canSplit: false },
        { text: '-m', isOpaque: false, canSplit: false },
        { text: '$MSG', isOpaque: true, canSplit: true },
      ],
    }),
    'cannot judge `git commit` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('refuses git merge, am and rebase with an opaque argument', () => {
  assert.equal(
    getBypassRefusal(withOpaque(gitCall('merge'))),
    'cannot judge `git merge` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
  assert.equal(
    getBypassRefusal(withOpaque(gitCall('am'))),
    'cannot judge `git am` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
  assert.equal(
    getBypassRefusal(withOpaque(gitCall('rebase', '-i'))),
    'cannot judge `git rebase` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('passes a commit operand after --', () => {
  assert.equal(getBypassRefusal(gitCall('commit', '--', '-n')), undefined);
});

test('refuses a -c value naming core.hooksPath in any case', () => {
  assert.equal(
    getBypassRefusal(withConfig(gitCall('commit', '-m', 'x'), 'core.hooksPath=/tmp/h')),
    bypassCatalog.reasons.hooksPath,
  );
  assert.equal(
    getBypassRefusal(withConfig(gitCall('status'), 'CORE.HOOKSPATH=x')),
    bypassCatalog.reasons.hooksPath,
  );
});

test('passes a -c value that is not core.hooksPath', () => {
  assert.equal(
    getBypassRefusal(withConfig(gitCall('commit'), 'color.ui=always')),
    undefined,
  );
});

test('refuses git config setting core.hooksPath in any case', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', 'core.hooksPath', '/tmp/h')),
    bypassCatalog.reasons.hooksPath,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--global', 'CORE.HOOKSPATH', 'x')),
    bypassCatalog.reasons.hooksPath,
  );
});

test('refuses git config removing or renaming the core section', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', '--remove-section', 'core')),
    bypassCatalog.reasons.configWrite,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--rename-section', 'Core', 'other')),
    bypassCatalog.reasons.configWrite,
  );
});

test('refuses git config opening an editor', () => {
  assert.equal(getBypassRefusal(gitCall('config', '-e')), bypassCatalog.reasons.configWrite);
  assert.equal(getBypassRefusal(gitCall('config', '--edit')), bypassCatalog.reasons.configWrite);
});

test('refuses git config with an argument the gate cannot read', () => {
  assert.equal(
    getBypassRefusal(withOpaque(gitCall('config', 'user.name'))),
    'cannot judge `git config` with an argument the gate cannot read'
    + '; quote it if it is one word, and start it with neither - nor +',
  );
});

test('refuses any git config call that names core.hooksPath, reads included', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', '--get', 'core.hooksPath')),
    bypassCatalog.reasons.hooksPath,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '-l', 'core.hooksPath')),
    bypassCatalog.reasons.hooksPath,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--comment', 'pull.rebase', 'core.hooksPath', '/dev/null')),
    bypassCatalog.reasons.hooksPath,
  );
});

test('passes git config reads of the core section', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--get-regexp', 'core')), undefined);
});

test('passes git config listings', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--list')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '-l')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', 'list')), undefined);
  assert.equal(
    getBypassRefusal(gitCall('config', '--show-origin', '--get', 'user.name')),
    undefined,
  );
});

test('passes git config of an allowed key', () => {
  assert.equal(getBypassRefusal(gitCall('config', 'pull.rebase', 'true')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', 'set', 'pull.rebase', 'true')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '--global', 'color.ui', 'auto')), undefined);
});

test('refuses git config of a key outside the allow-list', () => {
  assertUnsettable(gitCall('config', 'remote.origin.push', '+main'), 'remote.origin.push');
  assertUnsettable(gitCall('config', '--global', 'include.path', 'x'), 'include.path');
  assertUnsettable(gitCall('config', 'set', 'user.email', 'x'), 'user.email');
});

test('passes git config reads of a key outside the allow-list', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--get', 'remote.origin.url')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '-l')), undefined);
});

test('passes a -c of each kind of allowed key', () => {
  assert.equal(getBypassRefusal(withConfig(gitCall('log'), 'color.ui=always')), undefined);
  assert.equal(getBypassRefusal(withConfig(gitCall('diff'), 'core.quotePath=off')), undefined);
  assert.equal(getBypassRefusal(withConfig(gitCall('diff'), 'DIFF.Renames=true')), undefined);
});

test('refuses a -c of a key outside the allow-list', () => {
  assertUnsettable(withConfig(gitCall('log'), 'include.path=x'), 'include.path');
  assertUnsettable(
    withConfig(gitCall('log'), 'includeIf.gitdir:x.path=y'),
    'includeIf.gitdir:x.path',
  );
  assertUnsettable(withConfig(gitCall('push'), 'remote.origin.push=+main'), 'remote.origin.push');
  assertUnsettable(
    withConfig(gitCall('push'), 'remote.origin.mirror=true'),
    'remote.origin.mirror',
  );
  assertUnsettable(withConfig(gitCall('diff'), 'diff.external=x'), 'diff.external');
  assertUnsettable(withConfig(gitCall('commit'), 'core.editor=x'), 'core.editor');
  assertUnsettable(withConfig(gitCall('commit'), 'user.email=x'), 'user.email');
});

test('refuses a --config-env value of a key outside the allow-list', () => {
  assertUnsettable(withConfig(gitCall('log'), 'include.path=V'), 'include.path');
});

test('refuses a GIT_CONFIG assignment before any git call', () => {
  assert.equal(
    getBypassRefusal(withAssignment(gitCall('status'), 'GIT_CONFIG_COUNT')),
    bypassCatalog.reasons.configEnvironment,
  );
  assert.equal(
    getBypassRefusal(withAssignment(gitCall('log'), 'GIT_CONFIG_PARAMETERS')),
    bypassCatalog.reasons.configEnvironment,
  );
  assert.equal(
    getBypassRefusal(withAssignment(gitCall('log'), 'GIT_CONFIG_GLOBAL')),
    bypassCatalog.reasons.configEnvironment,
  );
});

test('passes an unrelated assignment', () => {
  assert.equal(getBypassRefusal(withAssignment(gitCall('status'), 'GIT_DIR')), undefined);
});

test('passes other git calls', () => {
  assert.equal(
    getBypassRefusal(withConfig(gitCall('commit'), 'color.ui=x')),
    undefined,
  );
  assert.equal(getBypassRefusal(gitCall('push', '--dry-run')), undefined);
  assert.equal(getBypassRefusal(gitCall('status')), undefined);
  assert.equal(getBypassRefusal(gitCall()), undefined);
});

test('refuses a -c alias in any case', () => {
  assert.equal(
    getBypassRefusal(withConfig(gitCall('status'), 'alias.x=!rm')),
    bypassCatalog.reasons.aliasConfig,
  );
  assert.equal(
    getBypassRefusal(withConfig(gitCall('status'), 'ALIAS.st=status')),
    bypassCatalog.reasons.aliasConfig,
  );
});

test('refuses a -c clean.requireForce in any case', () => {
  assert.equal(
    getBypassRefusal(withConfig(gitCall('clean'), 'clean.requireForce=false')),
    bypassCatalog.reasons.cleanRequireForceConfig,
  );
});

test('passes a -c of an allowed key and a value that only mentions alias', () => {
  assert.equal(getBypassRefusal(withConfig(gitCall('status'), 'color.ui=x')), undefined);
  assert.equal(getBypassRefusal(withConfig(gitCall('status'), 'color.ui=alias.x')), undefined);
});

test('refuses git config writing an alias or clean.requireForce', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', 'alias.x', '!rm')),
    bypassCatalog.reasons.aliasConfig,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--global', 'Alias.x', 'status')),
    bypassCatalog.reasons.aliasConfig,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--unset', 'alias.x')),
    bypassCatalog.reasons.aliasConfig,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', 'clean.requireForce', 'false')),
    bypassCatalog.reasons.cleanRequireForceConfig,
  );
});

test('passes git config reads of an alias', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--get', 'alias.x')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', 'get', 'clean.requireForce')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '--get-regexp', 'alias')), undefined);
});

test('ignores gh calls', () => {
  assert.equal(getBypassRefusal({ ...gitCall('commit', '--no-verify'), tool: 'gh' }), undefined);
});

test('refuses git config renaming or removing any section', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', '--rename-section', 'color', 'core')),
    bypassCatalog.reasons.configWrite,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--remove-section', 'user')),
    bypassCatalog.reasons.configWrite,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', 'rename-section', 'color', 'core')),
    bypassCatalog.reasons.configWrite,
  );
});

test('refuses a pager key, which runs a program', () => {
  assertUnsettable(withConfig(gitCall('log'), 'core.pager=x'), 'core.pager');
  assertUnsettable(gitCall('config', 'pager.log', 'x'), 'pager.log');
});

test('reads the value of a git config option as no key', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', '--comment', 'pull.rebase', 'alias.x', 'y')),
    bypassCatalog.reasons.aliasConfig,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '--comment', 'remote.x', 'pull.rebase', 'true')),
    undefined,
  );
  assert.equal(getBypassRefusal(gitCall('config', '--file=x', 'pull.rebase', 'true')), undefined);
});

test('refuses git config with an unknown option', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', '--bogus', 'pull.rebase', 'true')),
    bypassCatalog.reasons.configWrite,
  );
  assert.equal(
    getBypassRefusal(gitCall('config', '-x', 'pull.rebase', 'true')),
    bypassCatalog.reasons.configWrite,
  );
});

test('refuses git config with a quoted opaque option value or key', () => {
  assert.equal(
    getBypassRefusal({
      ...gitCall('config'),
      words: [
        { text: 'config', isOpaque: false, canSplit: false },
        { text: '--file', isOpaque: false, canSplit: false },
        { text: '$F', isOpaque: true, canSplit: false },
        { text: 'pull.rebase', isOpaque: false, canSplit: false },
      ],
    }),
    bypassCatalog.reasons.configWrite,
  );
  assert.equal(getBypassRefusal(withQuoted(gitCall('config'))), bypassCatalog.reasons.configWrite);
});

test('passes git config with a quoted opaque value', () => {
  assert.equal(getBypassRefusal(withQuoted(gitCall('config', 'pull.rebase'))), undefined);
});

test('refuses a git config write that names a denied key in any operand', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', 'pull.rebase', 'true', 'alias.x')),
    bypassCatalog.reasons.aliasConfig,
  );
});

test('refuses a git config write with more than key, value and pattern', () => {
  assert.equal(
    getBypassRefusal(gitCall('config', 'pull.rebase', 'a', 'b', 'c')),
    bypassCatalog.reasons.configWrite,
  );
});

test('passes a quoted opaque commit word anywhere', () => {
  assert.equal(getBypassRefusal(withQuoted(gitCall('commit', '-a'))), undefined);
});

test('passes git merge, am and rebase with a quoted opaque argument', () => {
  assert.equal(getBypassRefusal(withQuoted(gitCall('merge'))), undefined);
  assert.equal(getBypassRefusal(withQuoted(gitCall('rebase', '-i'))), undefined);
});
