import { spawnSync } from 'node:child_process';

const GIT_VERSION = /^git version (\d+)\.(\d+)/;
// git 2.17 added git worktree remove.
const OLDEST_GIT = { major: 2, minor: 17 };
const INSTALL_GIT = 'install git 2.17 or newer';

// The first tool the push test needs that is missing or too old, or
// undefined when every tool is there.
export function getToolViolation(
  env: NodeJS.ProcessEnv,
  limitSeconds: number,
): string | undefined {
  const timeout = limitSeconds * 1000;
  const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8', env, timeout });

  if (gitVersion.status !== 0) {
    return `git not found; ${ INSTALL_GIT }`;
  }

  const [, major, minor] = GIT_VERSION.exec(gitVersion.stdout) ?? [];

  if (!isGitNewEnough(Number(major), Number(minor))) {
    return `git is older than 2.17; ${ INSTALL_GIT }`;
  }

  const npmVersion = spawnSync('npm', ['--version'], { env, stdio: 'ignore', timeout });

  return npmVersion.status === 0 ? undefined : 'npm not found; install Node 24 or newer with npm';
}

function isGitNewEnough(major: number, minor: number): boolean {
  const isNewerMajor = major > OLDEST_GIT.major;

  return isNewerMajor || (major === OLDEST_GIT.major && minor >= OLDEST_GIT.minor);
}
