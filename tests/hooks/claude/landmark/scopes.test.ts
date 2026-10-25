import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../helpers/make-temp-dir.ts';

const RUN = join(import.meta.dirname, '..', '..', '..', '..', 'hooks', 'run.sh');
const SUBPROCESS_TIMEOUT_MS = 20000;

test('shows the scopes of the project catalog as one line', (t) => {
  const project = makeProject(t, '["api", "cli", "docs"]');
  const { status, stdout } = runScopes(project);

  assert.equal(status, 0);
  assert.equal(
    getContext(stdout),
    'Commit scopes of this repository (.claude/yapus/landmark/scopes.json): api, cli, docs;'
      + ' a new scope enters that file in the commit that first uses it.',
  );
});

test('stays silent when the project has no scope catalog', (t) => {
  const { status, stdout } = runScopes(makeTempDir(t));

  assert.deepEqual([status, stdout], [0, '']);
});

test('shows the violation when the catalog is not sorted', (t) => {
  const project = makeProject(t, '["docs", "api"]');
  const { status, stdout } = runScopes(project);
  const path = join(project, '.claude', 'yapus', 'landmark', 'scopes.json');

  assert.equal(status, 0);
  assert.equal(
    getContext(stdout),
    `${ path } is not a sorted array of distinct lowercase words; blocked until the catalog is fixed`,
  );
});

test('stays silent when CLAUDE_PROJECT_DIR is unset', (t) => {
  const project = makeProject(t, '["api"]');
  const { status, stdout } = runScopes(undefined, project);

  assert.deepEqual([status, stdout], [0, '']);
});

test('shows only the landmark catalog when the project also holds another', (t) => {
  const project = makeProject(t, '["api"]');
  const catalogs = join(project, 'hooks', 'shared', 'catalogs');

  mkdirSync(catalogs, { recursive: true });
  writeFileSync(join(catalogs, 'scopes.json'), '["agents", "bash"]');

  const { status, stdout } = runScopes(project);

  assert.equal(status, 0);
  assert.equal(
    getContext(stdout),
    'Commit scopes of this repository (.claude/yapus/landmark/scopes.json): api;'
      + ' a new scope enters that file in the commit that first uses it.',
  );
});

// A project with the scope catalog at the place landmark reads.
function makeProject(t: TestContext, catalogText: string): string {
  const project = makeTempDir(t);
  const directory = join(project, '.claude', 'yapus', 'landmark');

  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'scopes.json'), catalogText);

  return project;
}

// Runs the program through run.sh as the harness would, with the project
// directory in the environment and the given working directory.
function runScopes(
  project: string | undefined,
  cwd: string = process.cwd(),
): { status: number | null; stdout: string } {
  const sessionEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== 'CLAUDE_PROJECT_DIR'),
  );
  const commandRun = spawnSync('bash', [RUN, 'claude/landmark/scopes'], {
    cwd,
    encoding: 'utf8',
    env: project === undefined ? sessionEnv : { ...sessionEnv, CLAUDE_PROJECT_DIR: project },
    timeout: SUBPROCESS_TIMEOUT_MS,
  });

  return { status: commandRun.status, stdout: commandRun.stdout };
}

// The additionalContext of the SessionStart output, which must be one JSON line.
function getContext(stdout: string): string {
  const output: unknown = JSON.parse(stdout);

  assert.ok(isRecord(output) && isRecord(output.hookSpecificOutput));
  assert.equal(stdout, `${ JSON.stringify(output) }\n`);

  const context = output.hookSpecificOutput.additionalContext;

  assert.equal(typeof context, 'string');

  return String(context);
}
