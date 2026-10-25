import { existsSync } from 'node:fs';
import { getHooksPath } from '../../shared/hooks-path/get-hooks-path.ts';
import { getStampPath } from '../../shared/hooks-path/get-stamp-path.ts';
import { hasInjectedHooksPath } from '../../shared/hooks-path/has-injected-hooks-path.ts';
import { getRulesDir } from '../../shared/hooks-path/get-rules-dir.ts';

// What stops an install or an upgrade into home, one sentence each; empty when
// nothing does. An upgrade needs the stamp and ignores the rule files.
// globalHooksPath is the global core.hooksPath as git reads it, if set.
export function getConflicts(
  mode: 'install' | 'upgrade',
  { home, env, globalHooksPath }: {
    readonly home: string;
    readonly env: NodeJS.ProcessEnv;
    readonly globalHooksPath: string | undefined;
  },
): string[] {
  const rulesDir = getRulesDir(home);
  const stamp = getStampPath(home);
  const isUpgrade = mode === 'upgrade';
  const hasRulesDir = !isUpgrade && existsSync(rulesDir);
  const isForeign = globalHooksPath !== undefined && globalHooksPath !== getHooksPath(home);

  return [
    ...isUpgrade && !existsSync(stamp) ? [`${ stamp } is absent; use /landmark:install`] : [],
    ...!isUpgrade && existsSync(stamp) ? [`${ stamp } exists; use /landmark:upgrade`] : [],
    ...hasRulesDir ? [`${ rulesDir } exists; remove it first`] : [],
    ...isForeign ? [`the global core.hooksPath is ${ globalHooksPath }; unset it first`] : [],
    ...hasInjectedHooksPath(env)
      ? ['GIT_CONFIG_* sets core.hooksPath (the old agent layer); retire it first']
      : [],
  ];
}
