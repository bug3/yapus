import { getFirstLine } from '../../../shared/get-first-line.ts';
import { failed, getOutput, type GitFailure, isFailure, type Place, runGit } from './run-git.ts';

const HEAD_ARGS = ['rev-parse', '--verify', '-q', 'HEAD^{commit}'] as const;
const UNBORN_HEAD_STATUS = 1;

// HEAD's commit id, or the empty tree's id when HEAD is unborn. The empty
// tree's id depends on the repository's object format, so git computes it.
export function getHead(place: Place): string | GitFailure {
  const commit = runGit(HEAD_ARGS, place);

  if (isFailure(commit)) {
    return commit;
  }

  if (commit.status === 0) {
    return commit.stdout.trim();
  }

  if (commit.status === UNBORN_HEAD_STATUS && commit.stdout.trim() === '') {
    return getOutput(['hash-object', '-t', 'tree', '--stdin'], place);
  }

  return failed(HEAD_ARGS, getFirstLine(commit.stderr));
}
