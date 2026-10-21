import { isZeroSha, type PushRecord } from '../get-push-records.ts';

// git names a remote the push goes to either by its configured name or, when
// the push gave a URL or a path, by that text.
const REMOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// The revisions of one git log that lists the commits a push sends: for an
// update `^<remote sha> <local sha>`, for a new ref its `<local sha>`, and,
// when there is a new ref, last `--not --remotes=<remote>/*`, which leaves out
// the commits that remote already has; `--not` flips every revision after it,
// so the updates come first. Another remote's commits are not left out, and
// a push to a URL has no remote branches to leave out: its new refs are
// scanned whole. A deletion sends no commit. No revisions means nothing to
// scan.
export function getScanRanges(records: readonly PushRecord[], remote: string): string[] {
  const sent = records.filter(({ localSha }) => !isZeroSha(localSha));
  const updates = sent
    .filter(({ remoteSha }) => !isZeroSha(remoteSha))
    .flatMap(({ remoteSha, localSha }) => [`^${ remoteSha }`, localSha]);
  const newRefs = sent
    .filter(({ remoteSha }) => isZeroSha(remoteSha))
    .map(({ localSha }) => localSha);

  if (newRefs.length === 0) {
    return updates;
  }

  return isRemoteName(remote)
    ? [...updates, ...newRefs, '--not', `--remotes=${ remote }/*`]
    : [...updates, ...newRefs];
}

function isRemoteName(remote: string): boolean {
  return REMOTE_NAME.test(remote) && !remote.includes('..');
}
