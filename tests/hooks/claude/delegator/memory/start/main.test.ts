import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import type { TempFile } from '../../../../../helpers/make-temp-repo.ts';
import { makeAutoMemory } from '../../../../../helpers/memory/make-auto-memory.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';

const RUN_SH = join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'hooks', 'run.sh');
const HOOK_NAME = 'claude/delegator/memory/start';
const SUBPROCESS_TIMEOUT_MS = 10000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const WORK_ITEM: TempFile = {
  path: 'work/site.md',
  text: '---\ndescription: "The site"\n---\n',
};
const ONE_WORK_ITEM = 'Project memory is in .yapus/memory: work 1 (open items), rules 0,'
  + ' reference 0. Read a directory\'s index with Grep "^description:" when the person asks what'
  + ' is open or a task meets one of them.';
const UPKEEP = 'When a rule replaces another, keep the old file and give it superseded-by:'
  + ' "<new name>". When a work item is finished, write its lesson under rules/ or reference/'
  + ' first and delete its entry after, since a deleted file cannot be restored.';
const TIDY = 'Tidy these when the task allows: ask the person about a work item that may be'
  + ' finished, and sort what MEMORY.md holds beyond every session\'s need; an edit to an open'
  + ' entry restarts its count.';

interface Session {
  readonly env: NodeJS.ProcessEnv;
  readonly stdinText: string;
}

test('writes nothing and creates nothing in a project with no memory directory', (t) => {
  const projectRoot = makeTempDir(t);
  const hookRun = runHook(makeSession(t, projectRoot, []));

  assert.deepEqual(
    [hookRun.status, hookRun.stdout, hookRun.stderr, readdirSync(projectRoot)],
    [0, '', '', []],
  );
});

test('writes the directories, the rules of no call and the upkeep rules as context', (t) => {
  const projectRoot = makeMemoryProject(t, [
    WORK_ITEM,
    { path: 'rules/paid-runs.md', text: '---\ndescription: "Ask before a paid run"\n---\n' },
    { path: 'rules/briefs.md', text: '---\ndescription: "Keep a brief short"\n---\n' },
    { path: 'rules/merge.md', text: '---\ndescription: "d"\nevent: "gh pr merge"\n---\n' },
    { path: 'rules/old.md', text: '---\ndescription: "d"\nsuperseded-by: "briefs"\n---\n' },
    { path: 'reference/dns.md', text: '---\ndescription: "The DNS rows"\n---\n' },
  ]);
  const hookRun = runHook(makeSession(t, projectRoot, []));

  assert.deepEqual([hookRun.status, hookRun.stderr], [0, '']);
  assert.deepEqual(JSON.parse(hookRun.stdout), {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        'Project memory is in .yapus/memory: work 1 (open items), rules 4, reference 1. Read a'
        + ' directory\'s index with Grep "^description:" when the person asks what is open or a'
        + ' task meets one of them.',
        'Rules for a situation; read the file when its situation comes up:\n'
        + 'rules/briefs.md: Keep a brief short\n'
        + 'rules/paid-runs.md: Ask before a paid run',
        UPKEEP,
      ].join('\n\n'),
    },
  });
});

test('lists a work file left unchanged for 31 days and closes the list', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);

  setDaysBack(projectRoot, 31);

  assert.deepEqual(
    getBlocks(runHook(makeSession(t, projectRoot, []))),
    [ONE_WORK_ITEM, UPKEEP, `work/site.md: not changed for 31 days\n${ TIDY }`],
  );
});

test('lists no work file left unchanged for 29 days', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);

  setDaysBack(projectRoot, 29);

  assert.deepEqual(getBlocks(runHook(makeSession(t, projectRoot, []))), [ONE_WORK_ITEM, UPKEEP]);
});

test('lists an index of 21 lines with the limit it passes', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const session = makeSession(t, projectRoot, [{ path: 'MEMORY.md', text: '- a\n'.repeat(21) }]);

  assert.deepEqual(
    getBlocks(runHook(session)),
    [ONE_WORK_ITEM, UPKEEP, `MEMORY.md: 21 lines, over 20\n${ TIDY }`],
  );
});

test('lists no index of 20 lines', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const session = makeSession(t, projectRoot, [{ path: 'MEMORY.md', text: '- a\n'.repeat(20) }]);

  assert.deepEqual(getBlocks(runHook(session)), [ONE_WORK_ITEM, UPKEEP]);
});

test('lists an index line that links a topic file not in the auto memory directory', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const session = makeSession(t, projectRoot, [
    { path: 'MEMORY.md', text: '# Memory\n- [Gone](gone.md): a refused file\n' },
  ]);

  assert.deepEqual(getBlocks(runHook(session)), [
    ONE_WORK_ITEM,
    UPKEEP,
    `MEMORY.md line 2: gone.md is not in the auto memory directory\n${ TIDY }`,
  ]);
});

test('lists no index line that links a topic file in the auto memory directory', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const session = makeSession(t, projectRoot, [
    { path: 'MEMORY.md', text: '- [Kept](kept.md): a rule\n' },
    { path: 'kept.md', text: 'The rule.\n' },
  ]);

  assert.deepEqual(getBlocks(runHook(session)), [ONE_WORK_ITEM, UPKEEP]);
});

test('lists each file of the memory directory that cannot be used, with its reason', (t) => {
  const projectRoot = makeMemoryProject(t, [
    { path: 'reference/bare.md', text: 'No frontmatter.\n' },
    { path: 'rules/merge.md', text: '---\ndescription: "d"\nevent: "merge"\n---\n' },
    { path: 'rules/old.md', text: '---\ndescription: "d"\nsuperseded-by: "gone"\n---\n' },
    { path: 'work/site.md', text: '---\ndescription: "d"\nplan: "plans/site/plan.md"\n---\n' },
    { path: 'stray.md', text: '---\ndescription: "d"\n---\n' },
    { path: 'rules/deep/er.md', text: '---\ndescription: "d"\n---\n' },
  ]);

  assert.deepEqual(getBlocks(runHook(makeSession(t, projectRoot, []))).at(-1), [
    '.yapus/memory/reference/bare.md: no description',
    '.yapus/memory/rules/deep/er.md: outside work/, rules/ and reference/',
    '.yapus/memory/rules/merge.md: event "merge" is neither gh <group> <action> nor launch'
    + ' <agent type>',
    '.yapus/memory/rules/old.md: superseded-by names gone, which is not in rules/',
    '.yapus/memory/stray.md: outside work/, rules/ and reference/',
    '.yapus/memory/work/site.md: plan plans/site/plan.md does not exist',
    TIDY,
  ].join('\n'));
});

test('leaves out the index lines and keeps the rest with no index by the transcript', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const { env } = makeSession(t, projectRoot, [{ path: 'MEMORY.md', text: '- a\n'.repeat(21) }]);
  const stdinText = JSON.stringify({
    session_id: 's1',
    transcript_path: join(makeTempDir(t), 's1.jsonl'),
  });

  setDaysBack(projectRoot, 31);

  assert.deepEqual(
    getBlocks(runHook({ env, stdinText })),
    [ONE_WORK_ITEM, UPKEEP, `work/site.md: not changed for 31 days\n${ TIDY }`],
  );
});

test('leaves out the index lines and keeps the rest with an index it cannot read', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);
  const { env } = makeSession(t, projectRoot, []);
  const { memoryDirectory } = makeAutoMemory(t, [{ path: 'MEMORY.md', text: '- a\n'.repeat(21) }]);
  const stdinText = JSON.stringify({
    session_id: 's1',
    transcript_path: join(dirname(memoryDirectory), 's1.jsonl'),
  });

  chmodSync(join(memoryDirectory, 'MEMORY.md'), 0o000);
  setDaysBack(projectRoot, 31);

  assert.deepEqual(
    getBlocks(runHook({ env, stdinText })),
    [ONE_WORK_ITEM, UPKEEP, `work/site.md: not changed for 31 days\n${ TIDY }`],
  );
});

// A rule's line takes 99 characters here, so a 26th would pass 3,000.
test('keeps the context of 60 rules within 3,000 characters and counts the ones left out', (t) => {
  const rules = [...Array.from({ length: 60 }).keys()].map((index) => ({
    path: `rules/rule-${ String(index + 10) }.md`,
    text: `---\ndescription: "${ 'd'.repeat(80) }"\n---\n`,
  }));
  const projectRoot = makeMemoryProject(t, rules);
  const blocks = getBlocks(runHook(makeSession(t, projectRoot, [])));
  const signpostLines = (blocks[1] ?? '').split('\n');

  assert.deepEqual(
    [blocks.join('\n\n').length, signpostLines.length, signpostLines.at(-1)],
    [2986, 27, 'and 35 more'],
  );
});

test('writes nothing in a session switched off', (t) => {
  const session = makeSession(t, makeMemoryProject(t, [WORK_ITEM]), []);
  const sessionsDir = join(String(session.env.CLAUDE_PLUGIN_DATA), 'sessions');

  mkdirSync(sessionsDir);
  writeFileSync(join(sessionsDir, 's1.mode'), 'off');

  const hookRun = runHook(session);

  assert.deepEqual([hookRun.status, hookRun.stdout, hookRun.stderr], [0, '', '']);
});

test('exits 2 with one line on stderr for a memory file it cannot read', (t) => {
  const projectRoot = makeMemoryProject(t, [WORK_ITEM]);

  chmodSync(join(projectRoot, '.yapus', 'memory', WORK_ITEM.path), 0o000);

  const hookRun = runHook(makeSession(t, projectRoot, []));

  assert.deepEqual([hookRun.status, hookRun.stdout], [2, '']);
  assert.match(
    hookRun.stderr,
    /^yapus delegator memory start: cannot read .*memory: EACCES.*; the memory list is not given\n$/u,
  );
});

// A mode file that exists but cannot be read throws inside the program.
test('exits 2 with one line on stderr when the program crashes', (t) => {
  const session = makeSession(t, makeMemoryProject(t, [WORK_ITEM]), []);

  mkdirSync(join(String(session.env.CLAUDE_PLUGIN_DATA), 'sessions', 's1.mode'), {
    recursive: true,
  });

  const hookRun = runHook(session);

  assert.deepEqual([hookRun.status, hookRun.stdout], [2, '']);
  assert.match(hookRun.stderr, /^yapus delegator memory start: crashed: .*; fix the hook\n$/u);
});

// The session of a project: the caller's environment with the home, the
// configuration directory and the plugin data directory in the test's own
// directories, and a SessionStart payload whose transcript lies beside an
// auto memory directory holding indexFiles.
function makeSession(
  t: TestContext,
  projectRoot: string,
  indexFiles: readonly TempFile[],
): Session {
  const { configDirectory, memoryDirectory } = makeAutoMemory(t, indexFiles);

  return {
    env: {
      ...process.env,
      HOME: makeTempDir(t),
      CLAUDE_CONFIG_DIR: configDirectory,
      CLAUDE_PLUGIN_DATA: makeTempDir(t),
      CLAUDE_PROJECT_DIR: projectRoot,
    },
    stdinText: JSON.stringify({
      session_id: 's1',
      hook_event_name: 'SessionStart',
      source: 'startup',
      transcript_path: join(dirname(memoryDirectory), 's1.jsonl'),
    }),
  };
}

function runHook({ env, stdinText }: Session) {
  return spawnSync('bash', [RUN_SH, HOOK_NAME], {
    encoding: 'utf8',
    env,
    input: stdinText,
    timeout: SUBPROCESS_TIMEOUT_MS,
  });
}

// Sets the project's work item as last changed the given days before now.
function setDaysBack(projectRoot: string, days: number): void {
  const seconds = (Date.now() - days * MILLISECONDS_PER_DAY) / 1000;

  utimesSync(join(projectRoot, '.yapus', 'memory', WORK_ITEM.path), seconds, seconds);
}

// The blocks of the context a run wrote as its one JSON line.
function getBlocks({ stdout }: { readonly stdout: string }): string[] {
  const output: unknown = JSON.parse(stdout);

  assert.ok(isRecord(output) && isRecord(output.hookSpecificOutput));

  return String(output.hookSpecificOutput.additionalContext).split('\n\n');
}
