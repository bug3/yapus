import type { Call } from '../../calls/get-calls.ts';
import { isUnreadable } from '../get-unreadable-reason.ts';
import type { Arguments } from '../read-arguments.ts';
import { pushCatalog } from './push-catalog.ts';
import { readPushArguments } from './read-push-arguments.ts';

// A reason to refuse a dangerous `git push` judged from its words alone, or undefined.
export function getPushRefusal(call: Call): string | undefined {
  if (call.tool !== 'git' || call.words[0]?.text !== 'push') {
    return undefined;
  }

  const rest = call.words.slice(1);

  if (rest.some(isUnreadable)) {
    return pushCatalog.reasons.opaque;
  }

  const args = readPushArguments(rest);

  return getOptionRefusal(args) ?? getRefspecRefusal(args.operands.slice(1));
}

function getOptionRefusal(args: Arguments): string | undefined {
  const refused = pushCatalog.refusedOptions
    .find(({ names }) => names.some((name) => args.flags.has(name)));

  if (refused !== undefined) {
    return refused.reason;
  }

  const isLeaseUnguarded = args.flags.has(pushCatalog.leaseOption)
    && !args.flags.has(pushCatalog.includesOption);

  return isLeaseUnguarded ? pushCatalog.reasons.lease : undefined;
}

function getRefspecRefusal(refspecs: readonly string[]): string | undefined {
  if (refspecs.some((refspec) => refspec.startsWith(pushCatalog.forcePrefix))) {
    return pushCatalog.reasons.forceRefspec;
  }

  const isDelete = refspecs.some(
    (refspec) => refspec.startsWith(pushCatalog.deletePrefix) && refspec.length > 1,
  );

  return isDelete ? pushCatalog.reasons.delete : undefined;
}
