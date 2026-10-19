import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getHead } from '../git/get-head.ts';
import { type GitFailure, isFailure, type Place } from '../git/run-git.ts';
import { type BaseKey, getReflogBase } from './get-reflog-base.ts';
import { getStatePath } from './get-state-path.ts';

export type { BaseKey };

export interface Base {
  readonly kind: 'base';
  readonly id: string;
  readonly source: 'stored' | 'reflog' | 'head';
}

// The logged reason when the reflog gave no base and HEAD now stands in.
export const HEAD_FALLBACK_REASON = 'base fell back to HEAD now';

type Found = Pick<Base, 'id'> & { readonly source: 'reflog' | 'head' };

const OBJECT_ID = /^[0-9a-f]{40,64}$/;

// The commit the session's branch pointed to when the session started. The
// first answer is stored per session and root, so a branch switch or a commit
// later in the session cannot move it.
export function getBase(place: Place, key: BaseKey): Base | GitFailure {
  const path = getBasePath(key);
  const stored = readObjectId(path);

  if (stored !== undefined) {
    return { kind: 'base', id: stored, source: 'stored' };
  }

  const found = findBase(place, key);

  if (isFailure(found)) {
    return found;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, found.id);

  return { kind: 'base', ...found };
}

function getBasePath(key: BaseKey): string {
  const rootName = createHash('sha256').update(key.root).digest('hex');

  return join(getStatePath(key.dataDir, key.sessionId), `${ rootName }.base`);
}

function readObjectId(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const text = readFileSync(path, 'utf8').trim();

  return OBJECT_ID.test(text) ? text : undefined;
}

function findBase(place: Place, key: BaseKey): Found | GitFailure {
  const reflogId = getReflogBase(place, key);

  if (isFailure(reflogId)) {
    return reflogId;
  }

  if (reflogId !== undefined) {
    return { id: reflogId, source: 'reflog' };
  }

  const head = getHead(place);

  return isFailure(head) ? head : { id: head, source: 'head' };
}
