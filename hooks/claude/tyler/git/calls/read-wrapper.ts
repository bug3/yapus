import type { Word } from '../shell/split-commands.ts';
import { programName } from './program-name.ts';
import { type WrapperSpec, wrapperSpecs } from './wrapper-specs.ts';

// The words being read, which `env -S` replaces with the words of its string;
// `settings` holds the NAME=VALUE words of `assignments`, `unsets` the variables a wrapper
// removes (`env -u`), and `appender` names a wrapper read so far that adds arguments
// from stdin.
export interface Cursor {
  words: readonly Word[];
  index: number;
  readonly assignments: string[];
  readonly settings: Word[];
  readonly unsets: string[];
  appender: string | undefined;
}

export interface Reading {
  readonly kind: 'moved' | 'ended' | 'program';
}

// `shouldAlwaysDeny` holds when the part the gate cannot read may itself be the
// program that runs.
export interface Unreadable {
  readonly kind: 'unjudgeable';
  readonly reason: string;
  readonly shouldAlwaysDeny: boolean;
}

export const MOVED: Reading = { kind: 'moved' };

export const ENDED: Reading = { kind: 'ended' };

export const PROGRAM: Reading = { kind: 'program' };

// `NAME=`, `NAME+=` and `NAME[index]=`.
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]*\])?\+?=/;
const DIGIT_FLAG = /^-\d+$/;
// `env -S` gives these characters a meaning the gate does not read: escapes,
// variables, quotes and comments.
const SPLIT_SPECIAL = /[\\$'"#]/;

const WRAPPER_ARGUMENT: Unreadable = {
  kind: 'unjudgeable',
  reason: 'a wrapper argument the gate cannot read',
  shouldAlwaysDeny: true,
};

const SPLIT_TEXT: Unreadable = {
  kind: 'unjudgeable',
  reason: 'env -S text the gate cannot read',
  shouldAlwaysDeny: true,
};

// Applies the one rule that matches at the cursor: a reserved word, an assignment or a
// wrapper. `program` means no rule applies and the word at the cursor is the program.
export function readWrapper(cursor: Cursor): Reading | Unreadable {
  const word = cursor.words[cursor.index];

  if (word === undefined) {
    return ENDED;
  }

  const name = ASSIGNMENT.exec(word.text)?.[1];

  if (name !== undefined) {
    cursor.assignments.push(name);
    cursor.settings.push(word);
    cursor.index += 1;

    return MOVED;
  }

  if (word.isOpaque) {
    return PROGRAM;
  }

  if (wrapperSpecs.reservedWords.includes(word.text)) {
    cursor.index += 1;

    return MOVED;
  }

  const wrapperName = programName(word.text);
  const spec = wrapperSpecs.wrappers.find((candidate) => candidate.name === wrapperName);

  if (spec === undefined) {
    return PROGRAM;
  }

  cursor.index += 1;

  return skipOptions(cursor, spec);
}

function skipOptions(cursor: Cursor, spec: WrapperSpec): Reading | Unreadable {
  for (;;) {
    const word = cursor.words[cursor.index];

    if (word === undefined || isAssignment(word)) {
      break;
    }

    // An unquoted opaque word can expand to several words, so nothing past it is known.
    if (word.isOpaque) {
      return WRAPPER_ARGUMENT;
    }

    if (!word.text.startsWith('-')) {
      break;
    }

    if (spec.ends.includes(word.text)) {
      return ENDED;
    }

    if (spec.replacing.some((prefix) => word.text.startsWith(prefix))) {
      return {
        kind: 'unjudgeable',
        reason: `${ spec.name } replaces arguments the gate cannot read`,
        shouldAlwaysDeny: false,
      };
    }

    const split = readSplit(cursor, spec);

    if (split === 'unjudgeable') {
      return SPLIT_TEXT;
    }

    if (split === 'read') {
      continue;
    }

    const step = stepOf(word.text, spec);

    if (step === 0) {
      return {
        kind: 'unjudgeable',
        reason: `${ spec.name } option the gate cannot read`,
        shouldAlwaysDeny: false,
      };
    }

    if (hasOpaque(cursor.words, cursor.index + 1, cursor.index + step)) {
      return WRAPPER_ARGUMENT;
    }

    readOptionVariables(cursor, spec);

    cursor.index += step;
  }

  return finishWrapper(cursor, spec);
}

// Reads what follows the options: the fixed extra words, the `env` assignments, and a
// check on the word where the program should start (an opaque extra word was refused
// with the options).
function finishWrapper(cursor: Cursor, spec: WrapperSpec): Reading | Unreadable {
  cursor.index += spec.extraWords;

  if (spec.isAppending) {
    cursor.appender = spec.name;
  }

  while (spec.hasAssignments) {
    const word = cursor.words[cursor.index];

    if (word === undefined || word.text.startsWith('-') || !word.text.includes('=')) {
      break;
    }

    cursor.assignments.push(assignedName(word.text));
    cursor.settings.push(word);
    cursor.index += 1;
  }

  const next = cursor.words[cursor.index];

  if (next === undefined && spec.isShellWhenAlone) {
    return {
      kind: 'unjudgeable',
      reason: `${ spec.name } runs a shell the gate cannot read`,
      shouldAlwaysDeny: false,
    };
  }

  return next?.isOpaque === true && !isAssignment(next) ? WRAPPER_ARGUMENT : MOVED;
}

// Records the variable an option at the cursor sets (`arch -e NAME=VALUE`) or removes
// (`env -u NAME`, `-uNAME`, `--unset=NAME`); its value word is literal by now.
function readOptionVariables(cursor: Cursor, spec: WrapperSpec): void {
  const text = cursor.words[cursor.index]?.text ?? '';
  const next = cursor.words[cursor.index + 1];

  if (spec.assigning.includes(text) && next !== undefined) {
    cursor.assignments.push(assignedName(next.text));
    cursor.settings.push(next);
  }

  for (const option of spec.unsetting) {
    if (text === option) {
      cursor.unsets.push(next?.text ?? '');
    } else if (isAttached(text, option)) {
      cursor.unsets.push(text.slice(option.length));
    }
  }
}

// Whether a word holds a value attached to an option: `--name=` or a short `-x`.
function isAttached(text: string, option: string): boolean {
  const canAttach = option.endsWith('=') || !option.startsWith('--');

  return canAttach && text.startsWith(option) && text.length > option.length;
}

// The variable a NAME=VALUE, NAME+=VALUE or NAME[index]=VALUE word sets.
export function assignedName(text: string): string {
  return (text.split('=')[0] ?? '').replace(/[+[].*$/, '');
}

function isAssignment(word: Word): boolean {
  return ASSIGNMENT.test(word.text);
}

function hasOpaque(words: readonly Word[], start: number, end: number): boolean {
  return words.slice(start, end).some((word) => word.isOpaque);
}

// Puts the words of a split string (`env -S v`, `-Sv`, `--split-string v` or
// `--split-string=v`) in place of the option and its string, followed by the words
// after it, so the wrapper reads them as its own arguments. `none` when the word at the
// cursor is not such an option.
function readSplit(cursor: Cursor, spec: WrapperSpec): 'read' | 'none' | 'unjudgeable' {
  const { words, index } = cursor;
  const text = words[index]?.text ?? '';
  const isValued = spec.splitValued.includes(text);
  const prefix = spec.splitAttached.find((candidate) => text.startsWith(candidate));

  if (!isValued && prefix === undefined) {
    return 'none';
  }

  const string = isValued
    ? words[index + 1]
    : { text: text.slice(prefix?.length), isOpaque: words[index]?.isOpaque === true };

  if (string === undefined || string.isOpaque || SPLIT_SPECIAL.test(string.text)) {
    return 'unjudgeable';
  }

  const parts = string.text.split(/\s+/).filter((part) => part !== '');

  cursor.words = [
    ...parts.map((part) => ({ text: part, isOpaque: false, canSplit: false })),
    ...words.slice(index + (isValued ? 2 : 1)),
  ];
  cursor.index = 0;

  return 'read';
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
