import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getHooksPath } from '../../shared/hooks-path/get-hooks-path.ts';
import { hasInjectedHooksPath } from '../../shared/hooks-path/has-injected-hooks-path.ts';

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
  const rulesDir = join(home, '.claude', 'rules');
  const stamp = join(home, '.claude', 'landmark', 'version');
  const isUpgrade = mode === 'upgrade';
  const ruleFiles = !isUpgrade && existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((name) => /^landmark-.*\.md$/.test(name))
    : [];
  const isForeign = globalHooksPath !== undefined && globalHooksPath !== getHooksPath(home);

  return [
    ...isUpgrade && !existsSync(stamp) ? [`${ stamp } is absent; use /landmark:install`] : [],
    ...!isUpgrade && existsSync(stamp) ? [`${ stamp } exists; use /landmark:upgrade`] : [],
    ...ruleFiles.map((name) => `${ join(rulesDir, name) } exists; remove it first`),
    ...isForeign ? [`the global core.hooksPath is ${ globalHooksPath }; unset it first`] : [],
    ...hasInjectedHooksPath(env)
      ? ['GIT_CONFIG_* sets core.hooksPath (the old agent layer); retire it first']
      : [],
  ];
}
