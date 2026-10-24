import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getHooksPath } from '../../shared/hooks-path/get-hooks-path.ts';
import { hasInjectedHooksPath } from '../../shared/hooks-path/has-injected-hooks-path.ts';

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
