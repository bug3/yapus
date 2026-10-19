// The oldest git ashlar runs on: git 2.28 added diff --no-relative.
export const OLDEST_GIT = { major: 2, minor: 28 } as const;

const GIT_VERSION = /^git version ((\d+)\.(\d+)\S*)/u;

// The message for a git older than OLDEST_GIT, read from the output of
// git --version, or undefined when git is new enough. Output that names no
// version counts as too old.
export function getVersionShortfall(versionOutput: string): string | undefined {
  const [, found = versionOutput.trim(), major, minor] = GIT_VERSION.exec(versionOutput) ?? [];

  if (isNewEnough(Number(major), Number(minor))) {
    return undefined;
  }

  return `git ${ found } found; install git ${ String(OLDEST_GIT.major) }.`
    + `${ String(OLDEST_GIT.minor) } or newer`;
}

function isNewEnough(major: number, minor: number): boolean {
  const isNewerMajor = major > OLDEST_GIT.major;

  return isNewerMajor || (major === OLDEST_GIT.major && minor >= OLDEST_GIT.minor);
}
