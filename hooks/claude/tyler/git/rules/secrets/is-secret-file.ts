import { secretFiles } from './secret-files.ts';

interface Matcher {
  readonly isException: boolean;
  readonly name: RegExp;
}

// A name pattern is case-insensitive, because macOS file systems ignore case.
const MATCHERS: readonly Matcher[] = secretFiles.patterns.map((pattern) => ({
  isException: pattern.startsWith('!'),
  name: new RegExp(
    `^${ pattern.replace(/^!/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*') }$`,
    'i',
  ),
}));

// Whether a word names a file the never-commit catalog lists. The `--option=` and
// `<rev>:` prefixes (`--env-file=.env`, `HEAD:.env`) and surrounding quotes do not
// count; the name is the last path segment.
export function isSecretFile(word: string): boolean {
  const unquoted = word.replace(/^["'`]+|["'`]+$/g, '');
  const value = unquoted.startsWith('-') ? unquoted.slice(unquoted.indexOf('=') + 1) : unquoted;
  const name = value.slice(value.indexOf(':') + 1).split('/').pop() ?? '';

  return MATCHERS.some((matcher) => !matcher.isException && matcher.name.test(name))
    && !MATCHERS.some((matcher) => matcher.isException && matcher.name.test(name));
}
