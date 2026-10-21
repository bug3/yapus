import { runGit } from '../../../helpers/run-git.ts';

// Makes the remote's HEAD name the branch, as a clone leaves it. git lists a
// symbolic ref only when its target exists, so the branch is made too.
export function setRemoteHead(repository: string, remote: string, branch: string): void {
  const target = `refs/remotes/${ remote }/${ branch }`;

  runGit(['update-ref', target, 'HEAD'], repository);
  runGit(['symbolic-ref', `refs/remotes/${ remote }/HEAD`, target], repository);
}
