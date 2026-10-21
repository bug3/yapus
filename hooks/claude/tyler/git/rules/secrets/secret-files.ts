import neverCommit from '../../../../../shared/catalogs/never-commit.json' with { type: 'json' };

const patterns: readonly string[] = neverCommit;

// By basename; they list, create or change a file without reading its content.
const programs: readonly string[] = ['[', 'chmod', 'ls', 'mkdir', 'test', 'touch'];
const gitSubcommands: readonly string[] = ['check-ignore', 'status'];

// What the secret-file rule judges by: the never-commit patterns (a leading `!` marks
// an exception), the programs that never show a file's content, and the reasons.
export const secretFiles = {
  patterns,
  // How many strings a shell runs (`bash -c`) are read inside one another.
  maxNesting: 2,
  allowed: {
    programs,
    gitSubcommands,
    // Git subcommands allowed only with the flag.
    gitFlagged: [{ subcommand: 'rm', flag: '--cached' }],
  },
  reasons: {
    shown: (program: string, file: string): string =>
      `\`${ program }\` would show ${ file }, a file that holds secrets; a person reads it`,
    groupShown: (file: string): string =>
      `a redirection on a group of commands would show ${ file }, a file that holds secrets; `
      + 'a person reads it',
    unreadable: (file: string): string =>
      `the command cannot be read and names ${ file }, a file that holds secrets; `
      + 'a person reads it',
  },
} as const;
