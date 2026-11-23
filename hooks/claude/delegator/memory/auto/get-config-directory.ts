import { join } from 'node:path';

// Claude Code's configuration directory, which holds the auto memory of every
// project: CLAUDE_CONFIG_DIR, else .claude under HOME, else undefined. An
// empty variable reads as one that is not set, since an empty path would
// lead into the working directory.
export function getConfigDirectory(env: NodeJS.ProcessEnv): string | undefined {
  const configDirectory = env.CLAUDE_CONFIG_DIR;
  const home = env.HOME;

  if (configDirectory !== undefined && configDirectory !== '') {
    return configDirectory;
  }

  return home === undefined || home === '' ? undefined : join(home, '.claude');
}
