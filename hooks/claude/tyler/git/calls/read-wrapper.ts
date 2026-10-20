import type { Word } from '../shell/split-commands.ts';
import { programName } from './program-name.ts';
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

// The string that an option such as `env -S` hands over to be split again, and the words
// after it.
export interface SplitReading {
  readonly kind: 'split';
  readonly string: Word;
  readonly rest: readonly Word[];
}

export const MOVED: Reading = { kind: 'moved' };

export const ENDED: Reading = { kind: 'ended' };

export const PROGRAM: Reading = { kind: 'program' };

// `NAME=`, `NAME+=` and `NAME[index]=`.
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]*\])?\+?=/;
const WRAPPER_ARGUMENT = 'a wrapper argument the gate cannot read';
const DIGIT_FLAG = /^-\d+$/;

// Applies the one rule that matches at the cursor: a reserved word, an assignment or a
// wrapper. `program` means no rule applies and the word at the cursor is the program.
export function readWrapper(
  words: readonly Word[],
  cursor: Cursor,
): Reading | SplitReading | Unreadable {
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

  const wrapperName = programName(word.text);
  const spec = wrapperSpecs.wrappers.find((candidate) => candidate.name === wrapperName);

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
): Reading | SplitReading | Unreadable {
  for (;;) {
    const word = words[cursor.index];

    if (word === undefined || isAssignment(word)) {
      break;
    }

    // An unquoted opaque word can expand to several words, so nothing past it is known.
    if (word.isOpaque) {
      return { kind: 'unjudgeable', reason: WRAPPER_ARGUMENT };
    }

    if (!word.text.startsWith('-')) {
      break;
    }

    if (spec.ends.includes(word.text)) {
      return ENDED;
    }

    const split = readSplit(words, cursor.index, spec);

    if (split !== undefined) {
      return split;
    }

    const step = stepOf(word.text, spec);

    if (step === 0) {
      return {
        kind: 'unjudgeable',
        reason: `${ spec.name } option the gate cannot read`,
      };
    }

    if (hasOpaque(words, cursor.index + 1, cursor.index + step)) {
      return { kind: 'unjudgeable', reason: WRAPPER_ARGUMENT };
    }

    cursor.index += step;
  }

  return finishWrapper(words, cursor, spec);
}

// Reads what follows the options: the fixed extra words, the `env` assignments, and a
// check on the word where the program should start (an opaque extra word was refused
// with the options).
function finishWrapper(
  words: readonly Word[],
  cursor: Cursor,
  spec: WrapperSpec,
): Reading | Unreadable {
  cursor.index += spec.extraWords;

  while (spec.hasAssignments) {
    const word = words[cursor.index];

    if (word === undefined || word.text.startsWith('-') || !word.text.includes('=')) {
      break;
    }

    cursor.assignments.push((word.text.split('=')[0] ?? '').replace(/[+[].*$/, ''));
    cursor.index += 1;
  }

  const next = words[cursor.index];

  return next?.isOpaque === true && !isAssignment(next)
    ? { kind: 'unjudgeable', reason: WRAPPER_ARGUMENT }
    : MOVED;
}

function isAssignment(word: Word): boolean {
  return ASSIGNMENT.test(word.text);
}

function hasOpaque(words: readonly Word[], start: number, end: number): boolean {
  return words.slice(start, end).some((word) => word.isOpaque);
}

// The split string of an option written as `-S v` or `-Sv` or `--name v` or `--name=v`.
function readSplit(
  words: readonly Word[],
  index: number,
  spec: WrapperSpec,
): SplitReading | Unreadable | undefined {
  const word = words[index];
  const text = word?.text ?? '';

  if (spec.splitValued.includes(text)) {
    const string = words[index + 1];

    return string === undefined
      ? { kind: 'unjudgeable', reason: `${ spec.name } option the gate cannot read` }
      : { kind: 'split', string, rest: words.slice(index + 2) };
  }

  const prefix = spec.splitAttached.find((candidate) => text.startsWith(candidate));

  if (prefix === undefined) {
    return undefined;
  }

  const string = { text: text.slice(prefix.length), isOpaque: word?.isOpaque === true };

  return { kind: 'split', string, rest: words.slice(index + 1) };
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
