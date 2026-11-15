import { existsSync } from 'node:fs';
import { getHooksPath } from '../../shared/hooks-path/get-hooks-path.ts';
import { getStampPath } from '../../shared/hooks-path/get-stamp-path.ts';
import { hasInjectedHooksPath } from '../../shared/hooks-path/has-injected-hooks-path.ts';
import { getRulesDirectory } from '../../shared/hooks-path/get-rules-directory.ts';

// What stops an install or an upgrade into home, one sentence each; empty when
// nothing does. An upgrade needs the stamp and ignores the rules directory.
// globalHooksPath is the global core.hooksPath as git reads it, if set.
export function getConflicts(
  mode: 'install' | 'upgrade',
  { home, env, globalHooksPath }: {
    readonly home: string;
    readonly env: NodeJS.ProcessEnv;
    readonly globalHooksPath: string | undefined;
  },
): string[] {
  const rulesDirectory = getRulesDirectory(home);
  const stamp = getStampPath(home);
  const isUpgrade = mode === 'upgrade';
  const hasRulesDirectory = !isUpgrade && existsSync(rulesDirectory);
  const isForeign = globalHooksPath !== undefined && globalHooksPath !== getHooksPath(home);

  return [
    ...isUpgrade && !existsSync(stamp) ? [`${ stamp } is absent; use /ordo:machine`] : [],
    ...!isUpgrade && existsSync(stamp) ? [`${ stamp } exists; use /ordo:upgrade`] : [],
    ...hasRulesDirectory ? [`${ rulesDirectory } exists; remove it first`] : [],
    ...isForeign ? [`the global core.hooksPath is ${ globalHooksPath }; unset it first`] : [],
    ...hasInjectedHooksPath(env)
      ? ['GIT_CONFIG_* sets core.hooksPath (the old agent layer); retire it first']
      : [],
  ];
}
