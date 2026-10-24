import { getHooksPath } from '../../../shared/hooks-path/get-hooks-path.ts';
import { hasInjectedHooksPath } from '../../../shared/hooks-path/has-injected-hooks-path.ts';

export interface State {
  readonly pluginVersion: string;
  readonly stamp: string | undefined;
  readonly home: string;
  readonly globalHooksPath: string | undefined;
  readonly env: NodeJS.ProcessEnv;
}

// The one line the session should see, or undefined when all is in order.
export function getLine(state: State): string | undefined {
  const { pluginVersion, stamp, home, globalHooksPath, env } = state;
  const ownHooksPath = getHooksPath(home);

  if (stamp === undefined) {
    return 'yapus landmark is not installed on this machine; run /landmark:install.';
  }

  if (globalHooksPath !== undefined && globalHooksPath !== ownHooksPath) {
    return `yapus landmark: the global core.hooksPath is ${ globalHooksPath }, not its own;`
      + ' resolve it by hand.';
  }

  if (hasInjectedHooksPath(env)) {
    return 'yapus landmark: GIT_CONFIG_* sets core.hooksPath in this session;'
      + ' retire that injection by hand.';
  }

  if (stamp !== pluginVersion) {
    return `yapus landmark ${ stamp } is installed, the plugin is ${ pluginVersion };`
      + ' run /landmark:upgrade.';
  }

  if (globalHooksPath === undefined) {
    return 'yapus landmark: the global core.hooksPath is unset; run /landmark:upgrade.';
  }

  return undefined;
}
