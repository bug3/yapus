import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import {
  type GateContext,
} from '../../../../../../hooks/claude/tyler/ashlar/gate/get-gate-verdict.ts';
import type { Range } from '../../../../../../hooks/claude/tyler/ashlar/git/get-change.ts';
import { getSnapshot } from '../../../../../../hooks/claude/tyler/ashlar/git/get-snapshot.ts';
import { getBase } from '../../../../../../hooks/claude/tyler/ashlar/state/get-base.ts';
import {
  recordAcceptance,
} from '../../../../../../hooks/claude/tyler/ashlar/state/record-acceptance.ts';
import type { HookInput } from '../../../../../../hooks/claude/tyler/ashlar/parse-hook-input.ts';
import { isRecord } from '../../../../../../hooks/shared/is-record.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';
import { makeCommittedRepo } from '../make-committed-repo.ts';

export const SESSION = 's1';

export const THREE_LINES = 'x\ny\nz\n';

export interface Fixture {
  readonly repo: string;
  readonly dataDir: string;
}

// A committed repository and an empty data directory, both removed with the test.
export function makeGateFixture(t: TestContext): Fixture {
  return { repo: makeCommittedRepo(t), dataDir: makeTempDir(t) };
}

export function makeInput(cwd: string, isRetry = false): HookInput {
  return { sessionId: SESSION, cwd, event: 'Stop', isRetry };
}

export function makeContext(dataDir: string): GateContext {
  return { dataDir, env: process.env, time: '2026-10-19T10:00:00Z' };
}

export function setThreshold(dataDir: string, text: string): void {
  writeFileSync(join(dataDir, 'review-threshold'), text);
}

// The reasons in the data directory's decision log, in order.
export function readReasons(dataDir: string): readonly string[] {
  const path = join(dataDir, 'decisions.jsonl');
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line !== '');

  return lines.map((line) => {
    const entry: unknown = JSON.parse(line);

    return isRecord(entry) ? String(entry.reason) : '';
  });
}

// Stores the session's base as the repository's HEAD now, so a later commit
// is measured from it, and gives the base with the working tree now.
export function storeBase(fixture: Fixture): Range {
  const place = { cwd: fixture.repo, env: process.env };
  const snapshot = getSnapshot(place);

  if (snapshot.kind !== 'snapshot') {
    throw new Error('the fixture is not a repository');
  }

  const key = { dataDir: fixture.dataDir, sessionId: SESSION, root: snapshot.snapshot.root };
  const base = getBase(place, key);

  if (base.kind !== 'base') {
    throw new Error(base.reason);
  }

  return { base: base.id, tree: snapshot.snapshot.tree };
}

// Records an acceptance of the session's base and the working tree now.
export function acceptNow(fixture: Fixture): void {
  const range = storeBase(fixture);

  recordAcceptance(fixture.dataDir, SESSION, {
    time: '2026-10-19T10:00:00Z',
    agentId: 'warden-1',
    ...range,
  });
}
