import { runnerSpecs } from '../../calls/runner-specs.ts';
import neverCommit from '../../../../../shared/catalogs/never-commit.json' with { type: 'json' };

const patterns: readonly string[] = neverCommit;

// By basename; they list, create or change a file without reading its content.
const programs: readonly string[] = ['[', 'chmod', 'ls', 'mkdir', 'test', 'touch'];
const gitSubcommands: readonly string[] = ['check-ignore', 'status'];

const globSamples: readonly string[] = ['.env', '.env.local', 'x.pem', 'x.key', 'x.p12', 'id_rsa'];

// Programs that run code written in their arguments: the interpreters the gate already
// lists, and the text tools whose script can open a file.
const interpreters: readonly string[] = [
  ...runnerSpecs.runners
    .filter((group) => group.kind === 'interpreter')
    .flatMap((group) => group.names),
  'awk',
  'gawk',
  'jq',
  'mawk',
  'nawk',
  'sed',
];

// What the secret-file rule judges by: the never-commit patterns (a leading `!` marks
// an exception), the programs that never show a file's content, and the reasons.
export const secretFiles = {
  patterns,
  // How many strings a shell runs (`bash -c`) are read inside one another.
  maxNesting: 2,
  // The names an opaque word with a glob is tried against, one per pattern.
  globSamples,
  interpreters,
  // What a name may be made of when it is cut out of the code of an interpreter.
  nameBreaks: /[^A-Za-z0-9._/-]+/,
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
