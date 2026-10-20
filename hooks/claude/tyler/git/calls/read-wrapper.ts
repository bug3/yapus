import type { Word } from '../shell/split-commands.ts';
import { type WrapperSpec, wrapperSpecs } from './wrapper-specs.ts';

export interface Cursor {
  index: number;
  readonly assignments: string[];
}

export interface Reading {
  readonly kind: 'moved' | 'ended' | 'program';
}

export interface Unreadable {
  readonly kind: 'unjudgeable';
  readonly reason: string;
}

export const MOVED: Reading = { kind: 'moved' };

export const ENDED: Reading = { kind: 'ended' };

export const PROGRAM: Reading = { kind: 'program' };

const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=/;
const DIGIT_FLAG = /^-\d+$/;

// Applies the one rule that matches at the cursor: a reserved word, an assignment or a
// wrapper. `program` means no rule applies and the word at the cursor is the program.
export function readWrapper(
  words: readonly Word[],
  cursor: Cursor,
): Reading | Unreadable {
  const word = words[cursor.index];

  if (word === undefined) {
    return ENDED;
  }

  const name = ASSIGNMENT.exec(word.text)?.[1];

  if (name !== undefined) {
    cursor.assignments.push(name);
    cursor.index += 1;

    return MOVED;
  }

  if (word.isOpaque) {
    return PROGRAM;
  }

  if (wrapperSpecs.reservedWords.includes(word.text)) {
    cursor.index +=
      word.text === 'time' && words[cursor.index + 1]?.text === '-p' ? 2 : 1;

    return MOVED;
  }

  const spec = wrapperSpecs.wrappers.find((candidate) => candidate.name === word.text);

  if (spec === undefined) {
    return PROGRAM;
  }

  cursor.index += 1;

  return skipOptions(words, cursor, spec);
}

function skipOptions(
  words: readonly Word[],
  cursor: Cursor,
  spec: WrapperSpec,
): Reading | Unreadable {
  for (;;) {
    const word = words[cursor.index];

    if (word === undefined || word.isOpaque || !word.text.startsWith('-')) {
      break;
    }

    if (spec.ends.includes(word.text)) {
      return ENDED;
    }

    if (spec.rejected.some((prefix) => word.text.startsWith(prefix))) {
      return { kind: 'unjudgeable', reason: spec.rejectedReason };
    }

    const step = stepOf(word.text, spec);

    if (step === 0) {
      return {
        kind: 'unjudgeable',
        reason: `${ spec.name } option the gate cannot read`,
      };
    }

    cursor.index += step;
  }

  cursor.index += spec.extraWords;

  return MOVED;
}

// How many words an option takes; 0 when the gate does not know it.
function stepOf(text: string, spec: WrapperSpec): number {
  if (spec.valued.includes(text)) {
    return 2;
  }

  const isKnown =
    spec.flags.includes(text) ||
    spec.attached.some((prefix) => text.startsWith(prefix)) ||
    (spec.hasDigitFlag && DIGIT_FLAG.test(text));

  return isKnown ? 1 : 0;
}
