import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import {
  type Context,
  getContext,
} from '../../../../../../hooks/claude/delegator/memory/start/get-context.ts';
import { isRecord } from '../../../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';

const NOW = new Date('2026-11-23T12:00:00Z');
const WORK_ITEM: TempFile = { path: 'work/site.md', text: '---\ndescription: "The site"\n---\n' };
const SIXTY_RULES: readonly TempFile[] = [...Array.from({ length: 60 }).keys()].map((index) => ({
  path: `rules/rule-${ String(index + 10) }.md`,
  text: `---\ndescription: "${ 'd'.repeat(80) }"\n---\n`,
}));
const EIGHTY_BARE_FILES: readonly TempFile[] = [...Array.from({ length: 80 }).keys()].map(
  (index) => ({ path: `reference/bare-${ String(index + 10) }.md`, text: 'No frontmatter.\n' }),
);

test('is silent in a session switched off', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);

  assert.deepEqual(
    getContext({ stdinText: '{}', isOff: true, projectRoot, now: NOW }),
    { kind: 'silence' },
  );
});

test('is silent for a project root that is not set', () => {
  assert.deepEqual(
    getContext({ stdinText: '{}', isOff: false, projectRoot: undefined, now: NOW }),
    { kind: 'silence' },
  );
});

test('is silent for a project root that is not absolute', (t) => {
  const projectRoot = relative(process.cwd(), makeMemoryProject(t, [WORK_ITEM]));

  assert.deepEqual(
    getContext({ stdinText: '{}', isOff: false, projectRoot, now: NOW }),
    { kind: 'silence' },
  );
});

test('is silent where a file stands in the place of the memory directory', (t) => {
  const projectRoot = makeTempDir(t);

  mkdirSync(join(projectRoot, '.yapus'));
  writeFileSync(join(projectRoot, '.yapus', 'memory'), '');

  assert.deepEqual(
    getContext({ stdinText: '{}', isOff: false, projectRoot, now: NOW }),
    { kind: 'silence' },
  );
});

test('lists the memory for stdin that is not JSON', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const context = getContext({ stdinText: 'not json', isOff: false, projectRoot, now: NOW });

  assert.match(getBlocks(context)[0] ?? '', /: work 1 \(open items\), rules 0, reference 0\. /u);
});

test('writes no rules header with no rule to list', (t) => {
  const projectRoot = makeMemoryProject(t, [
    WORK_ITEM,
    { path: 'rules/merge.md', text: '---\ndescription: "d"\nevent: "gh pr merge"\n---\n' },
  ]);
  const context = getContext({ stdinText: '{}', isOff: false, projectRoot, now: NOW });

  assert.deepEqual(
    getBlocks(context).map((block) => block.split(' ')[0]),
    ['Project', 'When'],
  );
});

test('leaves out every finding once a rule is left out, each group with its count', (t) => {
  const projectRoot = makeMemoryProject(t, [
    ...SIXTY_RULES,
    { path: 'reference/bare-1.md', text: 'No frontmatter.\n' },
    { path: 'reference/bare-2.md', text: 'No frontmatter.\n' },
  ]);
  const blocks = getBlocks(getContext({ stdinText: '{}', isOff: false, projectRoot, now: NOW }));
  const [, signposts = '', , findings = ''] = blocks;

  assert.deepEqual(
    [
      blocks.join('\n\n').length,
      signposts.split('\n').at(-1),
      findings.split('\n').length,
      findings.split('\n')[0],
    ],
    [2902, 'and 39 more', 2, 'and 2 more'],
  );
});

test('keeps every rule and leaves out the findings past the cap with their count', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'rules/briefs.md', text: '---\ndescription: "Keep a brief short"\n---\n' },
    ...EIGHTY_BARE_FILES,
  ]);
  const blocks = getBlocks(getContext({ stdinText: '{}', isOff: false, projectRoot, now: NOW }));
  const [, signposts = '', , findings = ''] = blocks;

  assert.deepEqual(
    [
      blocks.join('\n\n').length,
      signposts.split('\n').at(-1),
      findings.split('\n').length,
      findings.split('\n').at(-2),
    ],
    [2989, 'rules/briefs.md: Keep a brief short', 44, 'and 38 more'],
  );
});

// The blocks of the context an output holds.
function getBlocks(context: Context): string[] {
  assert.ok(context.kind === 'output');

  const output: unknown = JSON.parse(context.json);

  assert.ok(isRecord(output) && isRecord(output.hookSpecificOutput));

  return String(output.hookSpecificOutput.additionalContext).split('\n\n');
}
