const HOOKS_PATH_KEY = 'core.hookspath';

// Whether GIT_CONFIG_COUNT with GIT_CONFIG_KEY_<n> names core.hooksPath.
export function hasInjectedHooksPath(env: NodeJS.ProcessEnv): boolean {
  const count = Number(env.GIT_CONFIG_COUNT ?? 0);

  return [...Array(Number.isInteger(count) ? count : 0).keys()]
    .some((index) => env[`GIT_CONFIG_KEY_${ String(index) }`]?.toLowerCase() === HOOKS_PATH_KEY);
}
