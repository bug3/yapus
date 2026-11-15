import { existsSync, renameSync, rmSync } from 'node:fs';

// Puts the directory at staging in place of the one at target by renames, so a
// reader sees the old directory or the new one, never a half-written one. The
// old one is renamed aside, the new one renamed in, the old one removed; if the
// second rename fails, the old one is renamed back.
export function swapDirectory(staging: string, target: string): void {
  const aside = `${ target }.old`;

  rmSync(aside, { recursive: true, force: true });

  if (existsSync(target)) {
    renameSync(target, aside);
  }

  try {
    renameSync(staging, target);
  } catch (error) {
    if (existsSync(aside)) {
      renameSync(aside, target);
    }

    throw error;
  }

  rmSync(aside, { recursive: true, force: true });
}
