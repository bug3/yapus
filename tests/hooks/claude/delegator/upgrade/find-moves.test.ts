import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { findMoves } from '../../../../../hooks/claude/delegator/upgrade/find-moves.ts';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';

const FIRST_LINE = '{"time":"2026-11-15T10:00:00.000Z","prompt":"go"}\n';
const NOVEMBER = new Date('2026-11-20T12:00:00.000Z');

type Files = readonly (readonly [name: string, text: string])[];

test('gives the moves of the logs before the moves of the plans', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/topic.md', 'the plan\n'],
    ['prompts/s1.jsonl', FIRST_LINE],
  ]);

  assert.deepEqual(findMoves(projectRoot), {
    moves: [
      { kind: 'log', from: 'prompts/s1.jsonl', to: 'sessions/2026-11/15T10-00-00Z_s1.jsonl' },
      { kind: 'removal', path: 'prompts' },
      { kind: 'plan', from: 'plans/topic.md', to: 'plans/2026-11/topic/plan.md' },
    ],
    left: [],
  });
});

test('gives the left files of the logs before the left files of the plans', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/two words.md', 'a plan\n'],
    ['prompts/notes.txt', 'a note\n'],
  ]);

  assert.deepEqual(
    findMoves(projectRoot).left.map(({ path }) => path),
    ['prompts/notes.txt', 'plans/two words.md'],
  );
});

test('gives no move and no left file for a project in the present layout', (t) => {
  const projectRoot = makeProject(t, [
    ['plans/2026-11/topic/plan.md', 'the plan\n'],
    ['sessions/.gitignore', '*\n'],
    ['sessions/2026-11/15T10-00-00Z_s1.jsonl', FIRST_LINE],
  ]);

  assert.deepEqual(findMoves(projectRoot), { moves: [], left: [] });
});

// A project whose .yapus/ holds the files, each written in November.
function makeProject(t: TestContext, files: Files): string {
  const projectRoot = makeTempDir(t);

  for (const [name, text] of files) {
    const path = join(projectRoot, '.yapus', name);

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    utimesSync(path, NOVEMBER, NOVEMBER);
  }

  return projectRoot;
}
