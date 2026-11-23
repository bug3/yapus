import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import type {
  Directory,
} from '../../../../../../hooks/claude/delegator/memory/get-memory-directory.ts';
import type { Entry } from '../../../../../../hooks/claude/delegator/memory/read-entries.ts';
import {
  getFindings,
} from '../../../../../../hooks/claude/delegator/memory/start/get-findings.ts';
import type {
  StartTexts,
} from '../../../../../../hooks/claude/delegator/memory/start/read-start-texts.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';

const TEXTS: StartTexts = {
  directories: '',
  signpostsHeader: '',
  signpost: '',
  upkeep: '',
  staleWork: 'work/<name>.md: <n> days',
  longIndex: 'index: <n> lines, over <limit>',
  missingTarget: 'index line <n>: no <target>',
  tidy: '',
  more: '',
};
const NOW = new Date('2026-11-23T12:00:00Z');
const NO_MEMORY = { entries: [], problems: [] };

test('lists a work file by its name and its whole days once they pass 30', () => {
  const memory = { entries: [makeEntry('work', '2026-10-23T11:00:00Z')], problems: [] };

  assert.deepEqual(
    getFindings(TEXTS, { memory, transcriptPath: undefined, now: NOW }),
    ['work/site.md: 31 days'],
  );
});

test('lists no work file left unchanged for an hour under 31 days', () => {
  const memory = { entries: [makeEntry('work', '2026-10-23T13:00:00Z')], problems: [] };

  assert.deepEqual(getFindings(TEXTS, { memory, transcriptPath: undefined, now: NOW }), []);
});

test('lists no rule and no reference file by its age', () => {
  const entries = [
    makeEntry('rules', '2026-01-01T00:00:00Z'),
    makeEntry('reference', '2026-01-01T00:00:00Z'),
  ];
  const memory = { entries, problems: [] };

  assert.deepEqual(getFindings(TEXTS, { memory, transcriptPath: undefined, now: NOW }), []);
});

test('lists an index of 21 lines whose last line ends in no line break', (t) => {
  const transcriptPath = makeTranscriptPath(t, [
    { path: 'MEMORY.md', text: `${ '- a\n'.repeat(20) }- a` },
  ]);

  assert.deepEqual(
    getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath, now: NOW }),
    ['index: 21 lines, over 20'],
  );
});

test('lists no index of 20 lines whose last line ends in no line break', (t) => {
  const transcriptPath = makeTranscriptPath(t, [
    { path: 'MEMORY.md', text: `${ '- a\n'.repeat(19) }- a` },
  ]);

  assert.deepEqual(getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath, now: NOW }), []);
});

test('lists each link to a topic file that is not beside the index, by its line', (t) => {
  const transcriptPath = makeTranscriptPath(t, [
    { path: 'MEMORY.md', text: '- [A](kept.md): a\n\n- [B](gone.md) - b, [C](lost.md)\n' },
    { path: 'kept.md', text: 'a\n' },
  ]);

  assert.deepEqual(
    getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath, now: NOW }),
    ['index line 3: no gone.md', 'index line 3: no lost.md'],
  );
});

test('lists no link to a URL, to a file in a directory or to a file that is not Markdown', (t) => {
  const transcriptPath = makeTranscriptPath(t, [{
    path: 'MEMORY.md',
    text: '- [U](https://example.test/gone.md) [D](notes/gone.md) ![I](gone.png)\n',
  }]);

  assert.deepEqual(getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath, now: NOW }), []);
});

test('lists nothing of an index when the session names no transcript', () => {
  assert.deepEqual(
    getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath: undefined, now: NOW }),
    [],
  );
});

test('lists nothing of an index that is not beside the transcript', (t) => {
  const transcriptPath = makeTranscriptPath(t, []);

  assert.deepEqual(getFindings(TEXTS, { memory: NO_MEMORY, transcriptPath, now: NOW }), []);
});

test('lists the rest without the lines of an index that cannot be read', (t) => {
  const transcriptPath = makeTranscriptPath(t, [{ path: 'MEMORY.md', text: '- [A](gone.md)\n' }]);
  const memory = { entries: [], problems: [{ path: 'stray.md', reason: 'outside' }] };

  chmodSync(join(dirname(transcriptPath), 'memory', 'MEMORY.md'), 0o000);

  assert.deepEqual(
    getFindings(TEXTS, { memory, transcriptPath, now: NOW }),
    ['stray.md: outside'],
  );
});

test('lists the work files, then the index, then each problem by its path and reason', (t) => {
  const transcriptPath = makeTranscriptPath(t, [{ path: 'MEMORY.md', text: '- [A](gone.md)\n' }]);
  const memory = {
    entries: [makeEntry('work', '2026-01-01T00:00:00Z')],
    problems: [{ path: '.yapus/memory/stray.md', reason: 'outside' }],
  };

  assert.deepEqual(getFindings(TEXTS, { memory, transcriptPath, now: NOW }), [
    'work/site.md: 326 days',
    'index line 1: no gone.md',
    '.yapus/memory/stray.md: outside',
  ]);
});

// An entry named site in the directory, last changed at the given time.
function makeEntry(directory: Directory, modifiedAt: string): Entry {
  return {
    directory,
    name: 'site',
    path: `.yapus/memory/${ directory }/site.md`,
    description: 'd',
    event: undefined,
    supersededBy: undefined,
    plan: undefined,
    modifiedAt: new Date(modifiedAt),
    body: '',
  };
}

// The transcript of a session beside an auto memory directory holding files.
function makeTranscriptPath(t: TestContext, files: readonly TempFile[]): string {
  return join(dirname(makeAutoMemory(t, files).memoryDirectory), 's1.jsonl');
}
