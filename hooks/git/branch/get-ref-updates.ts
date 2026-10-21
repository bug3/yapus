// A sha is 40 hex digits under SHA-1 and 64 under SHA-256; a symbolic ref
// update names a ref instead, as ref:<target>.
const VALUE = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|ref:\S+)$/;
const ZEROS = /^0+$/;
const HEADS = 'refs/heads/';
const FIELD_COUNT = 3;
const LINE_FORM = '"<old-value> <new-value> <ref-name>"';

export interface RefUpdate {
  readonly oldValue: string;
  readonly newValue: string;
  readonly ref: string;
}

export interface RefUpdates {
  readonly updates: RefUpdate[];
}

export interface RefLinesViolation {
  readonly violation: string;
}

// git writes one line per ref the transaction updates:
// <old-value> <new-value> <ref-name>. A malformed line refuses the whole
// transaction, since the hook cannot tell what it would let through.
export function getRefUpdates(stdinText: string): RefUpdates | RefLinesViolation {
  const lines = stdinText.split('\n');
  const malformedIndex = lines.findIndex((line) => line !== '' && !isRefLine(line));

  if (malformedIndex !== -1) {
    const lineNumber = String(malformedIndex + 1);

    return {
      violation: `ref line ${ lineNumber } is not ${ LINE_FORM }; the branch is refused, retry it`,
    };
  }

  return { updates: lines.filter((line) => line !== '').map(getUpdate) };
}

// Whether the update may create a branch: git writes an all-zero old value
// both for a new ref and for a forced update of an existing one.
export function canCreateBranch(update: RefUpdate): boolean {
  return ZEROS.test(update.oldValue) && update.ref.startsWith(HEADS);
}

// The branch name of a refs/heads/ ref.
export function getBranchName(ref: string): string {
  return ref.slice(HEADS.length);
}

function isRefLine(line: string): boolean {
  const fields = line.split(' ');
  const [oldValue = '', newValue = '', ref = ''] = fields;

  return fields.length === FIELD_COUNT && VALUE.test(oldValue) && VALUE.test(newValue)
    && ref !== '';
}

function getUpdate(line: string): RefUpdate {
  const [oldValue = '', newValue = '', ref = ''] = line.split(' ');

  return { oldValue, newValue, ref };
}
