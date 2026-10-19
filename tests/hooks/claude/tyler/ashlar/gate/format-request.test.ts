import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatRequest,
  type Request,
} from '../../../../../../hooks/claude/tyler/ashlar/gate/format-request.ts';

const BASE = 'abcdef0123456789abcdef0123456789abcdef01';
const REQUEST: Request = {
  base: BASE,
  change: { files: ['a.ts'], lines: 200 },
  threshold: 150,
  hits: [],
  diffPath: '/scratch/ashlar-s1.diff',
};
const ASK = 'launch providens:warden with the task\'s acceptance criteria '
  + 'and the diff in /scratch/ashlar-s1.diff';

test('names the lines past the threshold when no risk glob is hit', () => {
  assert.equal(
    formatRequest(REQUEST),
    `the change since abcdef012345 has 200 changed lines (threshold 150) with no accepted review; ${ ASK }`,
  );
});

test('names the risk hit and leaves the lines out when they are under the threshold', () => {
  const request = {
    ...REQUEST,
    change: { files: ['a.ts'], lines: 3 },
    hits: [{ file: 'hooks/a.ts', glob: 'hooks/**' }],
  };

  assert.equal(
    formatRequest(request),
    `the change since abcdef012345 touches hooks/a.ts (hooks/**) with no accepted review; ${ ASK }`,
  );
});

test('names both the lines and the risk hit', () => {
  const request = { ...REQUEST, hits: [{ file: 'hooks/a.ts', glob: 'hooks/**' }] };

  assert.equal(
    formatRequest(request),
    'the change since abcdef012345 has 200 changed lines (threshold 150) '
    + `and touches hooks/a.ts (hooks/**) with no accepted review; ${ ASK }`,
  );
});

test('names the first of several hits and counts the rest', () => {
  const request = {
    ...REQUEST,
    change: { files: ['a.ts'], lines: 3 },
    hits: [
      { file: 'hooks/a.ts', glob: 'hooks/**' },
      { file: 'hooks/b.ts', glob: 'hooks/**' },
      { file: 'src/c.ts', glob: 'src/**' },
    ],
  };

  assert.equal(
    formatRequest(request),
    'the change since abcdef012345 touches hooks/a.ts (hooks/**) and 2 more '
    + `with no accepted review; ${ ASK }`,
  );
});
