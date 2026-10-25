import type { TestContext } from 'node:test';
import { makeTempDir } from '../../../../helpers/make-temp-dir.ts';
import { getGitEnv } from '../../../../helpers/run-git.ts';

// The environment the plan tests pass to the plan: the test helpers' git
// environment with HOME and XDG_CONFIG_HOME pointing at an empty temporary
// directory. The plan drops every GIT_* variable, the helpers'
// GIT_CONFIG_NOSYSTEM and GIT_CONFIG_GLOBAL too, so git reads no user or XDG
// config but still reads the system config.
export function makeGitEnv(t: TestContext): NodeJS.ProcessEnv {
  const home = makeTempDir(t);

  return { ...getGitEnv(process.env), HOME: home, XDG_CONFIG_HOME: home };
}
