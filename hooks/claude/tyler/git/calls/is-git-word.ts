import { programName } from './program-name.ts';

export function isGitWord(text: string): boolean {
  const base = programName(text);

  return base === 'git' || base === 'gh' || base.startsWith('git-');
}
