// A sha is 40 hex digits under SHA-1 and 64 under SHA-256.
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const ZEROS = /^0+$/;
const FIELD_COUNT = 4;
const LINE_FORM = '"<local ref> <local sha> <remote ref> <remote sha>"';

export interface PushCommits {
  readonly commits: string[];
}

export interface PushLinesViolation {
  readonly violation: string;
}

// git writes one line per ref a push sends:
// <local ref> <local sha> <remote ref> <remote sha>. A deletion has an
// all-zero local sha and sends no commit.
export function getPushCommits(stdinText: string): PushCommits | PushLinesViolation {
  const lines = stdinText.split('\n');
  const malformedIndex = lines.findIndex((line) => line !== '' && !isPushLine(line));

  if (malformedIndex !== -1) {
    const lineNumber = String(malformedIndex + 1);

    return {
      violation: `push line ${ lineNumber } is not ${ LINE_FORM }; the push is blocked, retry it`,
    };
  }

  const localShas = lines
    .filter((line) => line !== '')
    .map(getLocalSha)
    .filter((sha) => !ZEROS.test(sha));

  return { commits: [...new Set(localShas)] };
}

function isPushLine(line: string): boolean {
  const fields = line.split(' ');
  const [localRef, localSha, remoteRef, remoteSha] = fields;
  const hasRefs = localRef !== '' && remoteRef !== '';
  const hasShas = SHA.test(localSha ?? '') && SHA.test(remoteSha ?? '');

  return fields.length === FIELD_COUNT && hasRefs && hasShas;
}

function getLocalSha(line: string): string {
  return line.split(' ')[1] ?? '';
}
