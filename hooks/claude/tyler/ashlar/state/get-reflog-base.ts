import { existsSync, readFileSync } from 'node:fs';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { failed, type GitFailure, isFailure, type Place, runGit } from '../git/run-git.ts';
import { getStatePath } from './get-state-path.ts';
import { START_SUFFIX } from './record-start.ts';

export interface BaseKey {
  readonly dataDir: string;
  readonly sessionId: string;
  readonly root: string;
}

const NO_ANSWER_STATUS = 1;
const DETACHED_REF = 'HEAD';

// The commit the session's branch (or HEAD, when detached) held at the session's
// recorded start, read from the reflog. undefined means the reflog gives no
// answer: no usable start time, or no usable entry for that time.
export function getReflogBase(place: Place, key: BaseKey): string | undefined | GitFailure {
  const start = readStart(key);

  return start === undefined ? undefined : findReflogId(place, start);
}

function readStart(key: BaseKey): Date | undefined {
  const path = getStatePath(key.dataDir, `${ key.sessionId }${ START_SUFFIX }`);

  if (!existsSync(path)) {
    return undefined;
  }

  const start = new Date(readFileSync(path, 'utf8').trim());

  return Number.isNaN(start.getTime()) ? undefined : start;
}

// Git reads "<seconds> +0000" as that exact instant; a reflog keeps whole
// seconds only.
function findReflogId(place: Place, start: Date): string | undefined | GitFailure {
  const ref = getRef(place);

  if (isFailure(ref)) {
    return ref;
  }

  const seconds = Math.floor(start.getTime() / 1000);
  const args = ['rev-parse', '--verify', '-q', `${ ref }@{${ String(seconds) } +0000}^{commit}`];
  const run = runGit(args, place);

  if (isFailure(run)) {
    return run;
  }

  // Any other exit is no answer: an empty reflog exits 128, not 1.
  return run.status === 0 ? run.stdout.trim() : undefined;
}

// The branch HEAD names, or HEAD itself when it is detached.
function getRef(place: Place): string | GitFailure {
  const args = ['symbolic-ref', '-q', '--short', 'HEAD'];
  const run = runGit(args, place);

  if (isFailure(run)) {
    return run;
  }

  if (run.status === 0) {
    return run.stdout.trim();
  }

  return run.status === NO_ANSWER_STATUS ? DETACHED_REF : failed(args, getFirstLine(run.stderr));
}
