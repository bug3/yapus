import type { Exclusion } from '../../../shared/exclusion/get-exclusion.ts';
import { getHooksPath } from '../../../shared/hooks-path/get-hooks-path.ts';
import { hasInjectedHooksPath } from '../../../shared/hooks-path/has-injected-hooks-path.ts';

// The exclusion lines after their placeholder, each on one line to be found whole.
const EXCLUDED_TAIL =
  " is in ~/.claude/yapus/ordo/excluded.json, so the ordo standards, the git checks, the dashes check and delegator's gh form checks do not apply here; run /ordo:include when the person asks.";
const INVALID_TAIL =
  '; ordo stays on in every project until the person fixes the file by hand.';

export interface State {
  readonly exclusion: Exclusion;
  readonly pluginVersion: string;
  readonly stamp: string | undefined;
  readonly home: string;
  readonly globalHooksPath: string | undefined;
  readonly env: NodeJS.ProcessEnv;
}

// The one line the main agent should see, or undefined when all is in
// order. The exclusion list comes before the state of the machine: in a
// listed project ordo does nothing, and this hook is where a broken list shows.
export function getLine(state: State): string | undefined {
  const { exclusion, pluginVersion, stamp, home, globalHooksPath, env } = state;
  const ownHooksPath = getHooksPath(home);

  if (exclusion.kind === 'excluded') {
    return `yapus ordo is off in this project: ${ exclusion.root }${ EXCLUDED_TAIL }`;
  }

  if (exclusion.kind === 'invalid') {
    return `yapus ordo: ${ exclusion.violation }${ INVALID_TAIL }`;
  }

  if (stamp === undefined) {
    return 'yapus ordo is not installed on this machine;'
      + ' tell the person, and run /ordo:machine when they ask.';
  }

  if (globalHooksPath !== undefined && globalHooksPath !== ownHooksPath) {
    return `yapus ordo: the global core.hooksPath is ${ globalHooksPath }, not its own;`
      + ' resolve it by hand.';
  }

  if (hasInjectedHooksPath(env)) {
    return 'yapus ordo: GIT_CONFIG_* sets core.hooksPath in this session;'
      + ' retire that injection by hand.';
  }

  if (stamp !== pluginVersion) {
    return `yapus ordo ${ stamp } is installed, the plugin is ${ pluginVersion };`
      + ' tell the person, and run /ordo:upgrade when they ask.';
  }

  if (globalHooksPath === undefined) {
    return 'yapus ordo: the global core.hooksPath is unset;'
      + ' tell the person, and run /ordo:upgrade when they ask.';
  }

  return undefined;
}
