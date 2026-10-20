import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Call } from '../../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import {
  getPushRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/push/get-push-refusal.ts';
import {
  pushCatalog,
} from '../../../../../../../hooks/claude/tyler/git/rules/push/push-catalog.ts';

const { reasons } = pushCatalog;

function gitCall(...texts: readonly string[]): Call {
  return {
    tool: 'git',
    words: texts.map((text) => ({ text, isOpaque: false, canSplit: false })),
    configs: [],
    assignments: [],
  };
}

function withOpaque(call: Call): Call {
  return { ...call, words: [...call.words, { text: '$X', isOpaque: true, canSplit: true }] };
}

test('refuses --force and -f, alone, in a group and next to a lease', () => {
  assert.equal(getPushRefusal(gitCall('push', '--force', 'origin', 'x')), reasons.force);
  assert.equal(getPushRefusal(gitCall('push', '-f')), reasons.force);
  assert.equal(getPushRefusal(gitCall('push', '-uf', 'origin', 'x')), reasons.force);
  assert.equal(
    getPushRefusal(gitCall('push', '--force', '--force-with-lease', '--force-if-includes')),
    reasons.force,
  );
  assert.equal(getPushRefusal(gitCall('push', '--dry-run', '--force')), reasons.force);
});

test('refuses an unambiguous prefix of a refused option', () => {
  assert.equal(getPushRefusal(gitCall('push', '--mirr')), reasons.mirror);
  assert.equal(getPushRefusal(gitCall('push', '--prun', 'origin')), reasons.prune);
});

test('leaves --forc unknown, as it starts three options', () => {
  assert.equal(getPushRefusal(gitCall('push', '--forc')), undefined);
});

test('refuses --force-with-lease without --force-if-includes', () => {
  assert.equal(getPushRefusal(gitCall('push', '--force-with-lease')), reasons.lease);
  assert.equal(getPushRefusal(gitCall('push', '--force-with-lease=main:abc')), reasons.lease);
  assert.equal(getPushRefusal(gitCall('push', '--force-with', 'origin')), reasons.lease);
});

test('refuses a lease when --no-force-if-includes comes last', () => {
  assert.equal(
    getPushRefusal(
      gitCall('push', '--force-with-lease', '--force-if-includes', '--no-force-if-includes'),
    ),
    reasons.lease,
  );
});

test('passes a lease that --force-if-includes follows or precedes', () => {
  assert.equal(
    getPushRefusal(
      gitCall('push', '--force-with-lease', '--force-if-includes', 'origin', 'feat/x'),
    ),
    undefined,
  );
  assert.equal(
    getPushRefusal(gitCall('push', '--force-with-lease=main:abc', '--force-if-includes')),
    undefined,
  );
  assert.equal(
    getPushRefusal(
      gitCall('push', '--no-force-if-includes', '--force-if-includes', '--force-with-lease'),
    ),
    undefined,
  );
});

test('passes a lease with --force-if-includes written as prefixes', () => {
  assert.equal(
    getPushRefusal(gitCall('push', '--force-with', '--force-if')),
    undefined,
  );
});

test('leaves an ambiguous prefix unknown', () => {
  assert.equal(getPushRefusal(gitCall('push', '--for', 'origin')), undefined);
});

test('refuses a refspec that starts with +', () => {
  assert.equal(getPushRefusal(gitCall('push', 'origin', '+main')), reasons.forceRefspec);
  assert.equal(getPushRefusal(gitCall('push', 'origin', 'a', '+b:c')), reasons.forceRefspec);
});

test('does not read the remote as a refspec', () => {
  assert.equal(getPushRefusal(gitCall('push', '+origin')), undefined);
});

test('refuses --mirror', () => {
  assert.equal(getPushRefusal(gitCall('push', '--mirror')), reasons.mirror);
});

test('refuses --delete, -d and a :dst refspec', () => {
  assert.equal(getPushRefusal(gitCall('push', '--delete', 'origin', 'x')), reasons.delete);
  assert.equal(getPushRefusal(gitCall('push', '-d', 'origin', 'x')), reasons.delete);
  assert.equal(getPushRefusal(gitCall('push', 'origin', ':x')), reasons.delete);
});

test('passes a lone : refspec', () => {
  assert.equal(getPushRefusal(gitCall('push', 'origin', ':')), undefined);
});

test('refuses --prune', () => {
  assert.equal(getPushRefusal(gitCall('push', '--prune', 'origin')), reasons.prune);
});

test('refuses an opaque argument', () => {
  assert.equal(getPushRefusal(withOpaque(gitCall('push', 'origin'))), reasons.opaque);
});

test('passes the ordinary forms', () => {
  assert.equal(getPushRefusal(gitCall('push')), undefined);
  assert.equal(getPushRefusal(gitCall('push', 'origin', 'main')), undefined);
  assert.equal(getPushRefusal(gitCall('push', '-u', 'origin', 'feat/x')), undefined);
  assert.equal(getPushRefusal(gitCall('push', '--tags')), undefined);
});

test('does not read the value of -o as an option', () => {
  assert.equal(getPushRefusal(gitCall('push', '-o', '--force', 'origin')), undefined);
  assert.equal(getPushRefusal(gitCall('push', '-o', '-f')), undefined);
});

test('does not read the value of --repo as a refspec', () => {
  assert.equal(getPushRefusal(gitCall('push', '--repo=+x', 'origin', 'main')), undefined);
  assert.equal(getPushRefusal(gitCall('push', '--repo', '--force', 'origin')), undefined);
});

test('reads an option after -o in the same group', () => {
  assert.equal(getPushRefusal(gitCall('push', '-fo', 'x')), reasons.force);
});

test('ignores a call that is not git push', () => {
  assert.equal(getPushRefusal(gitCall('commit', '--force')), undefined);
  assert.equal(getPushRefusal({ ...gitCall('push', '--force'), tool: 'gh' }), undefined);
});
