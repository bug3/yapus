import { realpathSync } from 'node:fs';
import { runGit } from './run-git.ts';

// The refusal line when root is not the top level of a git work tree.
export function getRootRefusal(root: string, env: NodeJS.ProcessEnv): string | undefined {
  const top = runGit(['rev-parse', '--show-toplevel'], root, env);
  const isRoot = top.status === 0 && realpathSync(top.stdout.trimEnd()) === realpathSync(root);

  return isRoot ? undefined : `${ root } is not the root of a git work tree`;
}
