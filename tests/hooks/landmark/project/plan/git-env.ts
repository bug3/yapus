import { getGitEnv } from '../../../../helpers/run-git.ts';

// The isolated environment the plan tests pass to the plan.
export const gitEnv = getGitEnv(process.env);
