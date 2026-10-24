import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getHooksPath } from './hooks-path/get-hooks-path.ts';

const HOOKS_PATH_KEY = 'core.hookspath';

// What stops an install into home, one sentence each; empty when nothing does.
// globalHooksPath is the global core.hooksPath as git reads it, if set.
export function getConflicts(
  home: string,
  env: NodeJS.ProcessEnv,
  globalHooksPath: string | undefined,
): string[] {
  const rulesDir = join(home, '.claude', 'rules');
  const stamp = join(home, '.claude', 'landmark', 'version');
  const ruleFiles = existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((name) => /^landmark-.*\.md$/.test(name))
    : [];
  const isForeign = globalHooksPath !== undefined && globalHooksPath !== getHooksPath(home);

  return [
    ...existsSync(stamp) ? [`${ stamp } exists; use /landmark:upgrade`] : [],
    ...ruleFiles.map((name) => `${ join(rulesDir, name) } exists; remove it first`),
    ...isForeign ? [`the global core.hooksPath is ${ globalHooksPath }; unset it first`] : [],
    ...hasInjectedHooksPath(env)
      ? ['GIT_CONFIG_* sets core.hooksPath (the old agent layer); retire it first']
      : [],
  ];
}

// Whether GIT_CONFIG_COUNT with GIT_CONFIG_KEY_<n> names core.hooksPath.
function hasInjectedHooksPath(env: NodeJS.ProcessEnv): boolean {
  const count = Number(env.GIT_CONFIG_COUNT ?? 0);

  return [...Array(Number.isInteger(count) ? count : 0).keys()]
    .some((index) => env[`GIT_CONFIG_KEY_${ String(index) }`]?.toLowerCase() === HOOKS_PATH_KEY);
}
