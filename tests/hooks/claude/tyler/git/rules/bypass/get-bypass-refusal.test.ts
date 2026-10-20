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
    words: texts.map((text) => ({ text, isOpaque: false })),
    configs: [],
    assignments: [],
  };
}

function withOpaque(call: Call): Call {
  return { ...call, words: [...call.words, { text: '$X', isOpaque: true }] };
}

function withConfig(call: Call, text: string): Call {
  return { ...call, configs: [{ text, isOpaque: false }] };
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

test('passes an opaque commit value and never reads it as a flag', () => {
  const opaqueFlag: Call = {
    ...gitCall('commit'),
    words: [{ text: 'commit', isOpaque: false }, { text: '-n', isOpaque: true }],
  };

  assert.equal(getBypassRefusal(opaqueFlag), undefined);
  assert.equal(getBypassRefusal(withOpaque(gitCall('commit', '-a'))), undefined);
  assert.equal(getBypassRefusal(withOpaque(gitCall('push', 'origin'))), undefined);
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
    getBypassRefusal(withConfig(gitCall('commit'), 'user.name=x')),
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
    bypassCatalog.reasons.configWrite,
  );
});

test('passes git config reads of core.hooksPath', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--get', 'core.hooksPath')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '--get-all', 'core.hooksPath')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '--get-regexp', 'core')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', 'get', 'core.hooksPath')), undefined);
});

test('passes git config listings', () => {
  assert.equal(getBypassRefusal(gitCall('config', '--list')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '-l')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '-l', 'core.hooksPath')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', 'list')), undefined);
  assert.equal(
    getBypassRefusal(gitCall('config', '--show-origin', '--get', 'core.hooksPath')),
    undefined,
  );
});

test('passes git config of an unrelated key', () => {
  assert.equal(getBypassRefusal(gitCall('config', 'user.email', 'x')), undefined);
  assert.equal(getBypassRefusal(gitCall('config', '--remove-section', 'user')), undefined);
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
    getBypassRefusal(withConfig(gitCall('commit'), 'user.name=x')),
    undefined,
  );
  assert.equal(getBypassRefusal(gitCall('push', '--dry-run')), undefined);
  assert.equal(getBypassRefusal(gitCall('status')), undefined);
  assert.equal(getBypassRefusal(gitCall()), undefined);
});

test('ignores gh calls', () => {
  assert.equal(getBypassRefusal({ ...gitCall('commit', '--no-verify'), tool: 'gh' }), undefined);
});
