import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../../helpers/run-git.ts';

// The environment the plan tests pass to the plan: the caller's environment
// without GIT_* and CLAUDECODE, with HOME and XDG_CONFIG_HOME pointing at an
// empty temporary directory, so no git config of the machine is read. The plan
// drops GIT_* variables itself, so only HOME and XDG_CONFIG_HOME isolate it.
export function makeGitEnv(t: TestContext): NodeJS.ProcessEnv {
  const home = makeTempDir(t);

  return { ...getGitEnv(process.env), HOME: home, XDG_CONFIG_HOME: home };
}
