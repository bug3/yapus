const HOOKS_PATH_KEY = 'core.hookspath';
const KEY_VARIABLE = /^GIT_CONFIG_KEY_[0-9]+$/;

// Whether any GIT_CONFIG_KEY_<n> variable names core.hooksPath. GIT_CONFIG_COUNT
// is not read: a stricter reading than git's could miss an injection git accepts.
export function hasInjectedHooksPath(env: NodeJS.ProcessEnv): boolean {
  return Object.entries(env)
    .some(([name, value]) => KEY_VARIABLE.test(name) && value?.toLowerCase() === HOOKS_PATH_KEY);
}
