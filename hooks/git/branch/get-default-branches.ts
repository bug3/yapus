import { runExpecting } from './run-expecting.ts';
import { isFailure } from './run-git.ts';

const ALWAYS = ['refs/heads/main', 'refs/heads/master'];
const REMOTES = 'refs/remotes/';
const HEAD_SUFFIX = '/HEAD';
const SUCCESS = 0;
const NOT_FOUND = 1;

export interface DefaultBranchQuery {
  readonly repository: string;
  readonly env: NodeJS.ProcessEnv;
  readonly deadline: number;
}

export interface DefaultBranchViolation {
  readonly violation: string;
}

// The branches that count as the default, as full refs: main and master
// always, plus init.defaultBranch and the branch every remote's HEAD names,
// whichever remote the branch comes from. A union, so that a branch the agent can
// name through config or a moved remote HEAD only adds protection.
export function getDefaultBranches(
  { repository, env, deadline }: DefaultBranchQuery,
): string[] | DefaultBranchViolation {
  const place = { cwd: repository, env, deadline };
  const configArgs = ['config', '--get', 'init.defaultBranch'];
  const config = runExpecting(configArgs, [SUCCESS, NOT_FOUND], place);

  if (isFailure(config)) {
    return cannotRead(config.reason);
  }

  const configured = config.status === SUCCESS && config.stdout.trim() !== ''
    ? [`refs/heads/${ config.stdout.trim() }`]
    : [];
  const refsArgs = ['for-each-ref', '--format=%(refname) %(symref)', 'refs/remotes'];
  const refs = runExpecting(refsArgs, [SUCCESS], place);

  if (isFailure(refs)) {
    return cannotRead(refs.reason);
  }

  const heads = getRemoteHeads(refs.stdout);

  return 'violation' in heads ? heads : [...ALWAYS, ...configured, ...heads];
}

// Whether the ref is one of the default branches, ignoring case: some servers
// and file systems fold it, so refs/heads/MAIN is main.
export function isDefaultBranch(defaultBranches: readonly string[], ref: string): boolean {
  return defaultBranches.some((branch) => branch.toLowerCase() === ref.toLowerCase());
}

// The branch each remote HEAD in the for-each-ref lines names, as refs/heads/.
function getRemoteHeads(lines: string): string[] | DefaultBranchViolation {
  const heads: string[] = [];

  for (const line of lines.split('\n')) {
    const [refname = '', symref = ''] = line.split(' ');

    if (!refname.endsWith(HEAD_SUFFIX) || symref === '') {
      continue;
    }

    const remote = refname.slice(REMOTES.length, -HEAD_SUFFIX.length);
    const prefix = `${ REMOTES }${ remote }/`;

    if (!symref.startsWith(prefix) || symref === prefix) {
      return cannotRead(`${ refname } points to ${ symref }`);
    }

    heads.push(`refs/heads/${ symref.slice(prefix.length) }`);
  }

  return heads;
}

function cannotRead(detail: string): DefaultBranchViolation {
  return {
    violation: `cannot read the default branch (${ detail }); the branch is refused, retry it`,
  };
}
