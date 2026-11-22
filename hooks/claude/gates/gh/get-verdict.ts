import { getExclusion } from '../../../shared/exclusion/get-exclusion.ts';
import { findGhCalls } from './calls/find-gh-calls.ts';
import { getIssueRefusal } from './rules/get-issue-refusal.ts';
import { getPrRefusal } from './rules/get-pr-refusal.ts';
import { ghCommands, type GhAction } from './rules/gh-commands.ts';
import type { GhCatalogs } from './rules/read-gh-catalogs.ts';
import { readRepositoryCatalogs } from './rules/read-repository-catalogs.ts';
import { splitCommands, type Word } from './shell/split-commands.ts';

export interface Pass {
  readonly kind: 'pass';
}

export interface Refuse {
  readonly kind: 'refuse';
  readonly reason: string;
}

export type Verdict = Pass | Refuse;

// A reason to refuse one action's call, given the words after the action, the
// directory it runs in (undefined when unknown) and the catalogs of its
// repository (undefined when it has none), or undefined.
type ActionRefusal = (
  words: readonly Word[],
  cwd: string | undefined,
  catalogs: GhCatalogs | undefined,
) => string | undefined;

export const PASS: Pass = { kind: 'pass' };

const REFUSALS: Readonly<Record<GhAction, ActionRefusal>> = {
  prCreate: getPrRefusal,
  issueCreate: getIssueRefusal,
};

// The judged actions as written on a command line, for one that cannot be split;
// any run of spaces or tabs may separate the words.
const MENTIONS: readonly RegExp[] = Object.values(ghCommands.actions)
  .flatMap(({ spellings }) => spellings.map((spelling) => new RegExp(
    `gh[ \\t]+${ spelling.replaceAll(' ', '[ \\t]+') }`,
    'u',
  )));

// Whether a Bash command may run, judged from `cwd`, the absolute directory it
// starts in. Only the gh actions in the catalog are judged, each by the
// catalogs of the repository it runs in, or of the starting directory when a
// `cd` hid where it runs; a call in a project on ordo's exclusion list under
// `home` is not judged. A command that cannot be split is refused only when it
// mentions one of them outside an excluded starting directory.
export async function getVerdict(
  command: string,
  cwd: string,
  { home, env }: { readonly home: string; readonly env: NodeJS.ProcessEnv },
): Promise<Verdict> {
  const split = splitCommands(command);

  if ('failure' in split) {
    return MENTIONS.some((mention) => mention.test(command)) && !isExcluded(cwd, home, env)
      ? refuse(ghCommands.reasons.unreadableCommand(split.failure))
      : PASS;
  }

  for (const call of findGhCalls(split, cwd)) {
    const directory = call.cwd ?? cwd;

    if (isExcluded(directory, home, env)) {
      continue;
    }

    const catalogs = await readRepositoryCatalogs(directory);

    if (catalogs !== undefined && 'violation' in catalogs) {
      return refuse(catalogs.violation);
    }

    const reason = REFUSALS[call.action](call.argumentWords, call.cwd, catalogs);

    if (reason !== undefined) {
      return refuse(reason);
    }
  }

  return PASS;
}

// An invalid list leaves ordo on, as an absent one does; the session check
// shows its violation.
function isExcluded(directory: string, home: string, env: NodeJS.ProcessEnv): boolean {
  return getExclusion(directory, home, env).kind === 'excluded';
}

export function refuse(reason: string): Refuse {
  return { kind: 'refuse', reason };
}
