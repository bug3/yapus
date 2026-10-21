// A sha is 40 hex digits under SHA-1 and 64 under SHA-256.
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const ZEROS = /^0+$/;
const FIELD_COUNT = 4;
const LINE_FORM = '"<local ref> <local sha> <remote ref> <remote sha>"';

export interface PushRecord {
  readonly localRef: string;
  readonly localSha: string;
  readonly remoteRef: string;
  readonly remoteSha: string;
}

export interface PushRecords {
  readonly records: PushRecord[];
}

export interface PushLinesViolation {
  readonly violation: string;
}

// git writes one line per ref a push sends:
// <local ref> <local sha> <remote ref> <remote sha>. A deletion has an
// all-zero local sha, a new remote ref an all-zero remote sha.
export function getPushRecords(stdinText: string): PushRecords | PushLinesViolation {
  const lines = stdinText.split('\n');
  const malformedIndex = lines.findIndex((line) => line !== '' && !isPushLine(line));

  if (malformedIndex !== -1) {
    const lineNumber = String(malformedIndex + 1);

    return {
      violation: `push line ${ lineNumber } is not ${ LINE_FORM }; the push is blocked, retry it`,
    };
  }

  return { records: lines.filter((line) => line !== '').map(getRecord) };
}

export function isZeroSha(sha: string): boolean {
  return ZEROS.test(sha);
}

function isPushLine(line: string): boolean {
  const fields = line.split(' ');
  const [localRef, localSha, remoteRef, remoteSha] = fields;
  const hasRefs = localRef !== '' && remoteRef !== '';
  const hasShas = SHA.test(localSha ?? '') && SHA.test(remoteSha ?? '');

  return fields.length === FIELD_COUNT && hasRefs && hasShas;
}

function getRecord(line: string): PushRecord {
  const [localRef = '', localSha = '', remoteRef = '', remoteSha = ''] = line.split(' ');

  return { localRef, localSha, remoteRef, remoteSha };
}
