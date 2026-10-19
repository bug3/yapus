import { resolve } from 'node:path';
import { getOutput, type GitFailure, isFailure, type Place } from './run-git.ts';

// The absolute path a session's diff is written to: <git dir>/ashlar/<id>.diff.
// It sits inside the project, where the reviewer may read it, and git never
// adds a file of its own directory, so the diff leaves the tree id alone. A
// linked worktree gets its own git dir. It builds the path and writes nothing;
// a git failure comes back as a value.
export function getDiffPath(place: Place, sessionId: string): string | GitFailure {
  const gitPath = getOutput(['rev-parse', '--git-path', `ashlar/${ sessionId }.diff`], place);

  return isFailure(gitPath) ? gitPath : resolve(place.cwd, gitPath);
}
