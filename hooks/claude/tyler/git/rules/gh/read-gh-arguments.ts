import type { Word } from '../../shell/split-commands.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { ghCommands, type ActionSpec, type OptionSpec } from './gh-commands.ts';

export interface GhArguments {
  // Every value of a value option, in the order written.
  readonly values: ReadonlyMap<string, readonly Word[]>;
  readonly flags: ReadonlyMap<string, boolean>;
  readonly operands: readonly Word[];
}

export interface GhRefusal {
  readonly refusal: string;
}

// The state of one read: the words still to read and what they gave so far.
interface Reading {
  readonly spec: ActionSpec;
  readonly queue: Word[];
  readonly values: Map<string, Word[]>;
  readonly flags: Map<string, boolean>;
  readonly operands: Word[];
}

interface Written {
  readonly shown: string;
  // The value written in the same word, after `=` or the letter.
  readonly attached: Word | undefined;
}

const { readerReasons } = ghCommands;

// Reads the words after a gh action against its options, as pflag does: a long
// option exactly, `--long=value`, `-s value`, `-svalue`, `-s=value`, and a short
// group of flag letters that may end with one value letter.
export function readGhArguments(
  words: readonly Word[],
  spec: ActionSpec,
): GhArguments | GhRefusal {
  if (words.some(isUnreadable)) {
    return { refusal: getUnreadableReason(spec.command) };
  }

  const reading: Reading = {
    spec,
    queue: [...words],
    values: new Map(),
    flags: new Map(),
    operands: [],
  };
  let isAfterDashes = false;

  for (let word = reading.queue.shift(); word !== undefined; word = reading.queue.shift()) {
    const { text } = word;
    let refusal: string | undefined;

    if (isAfterDashes || !text.startsWith('-') || text === '-') {
      reading.operands.push(word);
    } else if (text === '--') {
      isAfterDashes = true;
    } else if (text.startsWith('--')) {
      refusal = readLong(reading, word);
    } else {
      refusal = readShortGroup(reading, word);
    }

    if (refusal !== undefined) {
      return { refusal };
    }
  }

  const { values, flags, operands } = reading;

  return { values, flags, operands };
}

function readLong(reading: Reading, word: Word): string | undefined {
  const equals = word.text.indexOf('=');
  const name = equals < 0 ? word.text : word.text.slice(0, equals);
  const option = reading.spec.options.find(({ long }) => `--${ long }` === name);

  if (option === undefined) {
    return readerReasons.unknownOption(reading.spec.command, name);
  }

  const attached = equals < 0 ? undefined : { ...word, text: word.text.slice(equals + 1) };

  return apply(reading, option, { shown: name, attached });
}

function readShortGroup(reading: Reading, word: Word): string | undefined {
  let rest = word.text.slice(1);

  while (rest !== '') {
    const letter = rest.slice(0, 1);
    const option = reading.spec.options.find(({ short }) => short === letter);

    if (option === undefined) {
      return readerReasons.unknownOption(reading.spec.command, `-${ letter }`);
    }

    rest = rest.slice(1);

    if (rest === '=') {
      return readerReasons.bareEquals(reading.spec.command, `-${ letter }`);
    }

    const hasAttached = rest !== '' && (option.kind === 'value' || rest.startsWith('='));
    const text = rest.startsWith('=') ? rest.slice(1) : rest;
    const attached = hasAttached ? { ...word, text } : undefined;
    const refusal = apply(reading, option, { shown: `-${ letter }`, attached });

    if (refusal !== undefined || option.kind === 'value') {
      return refusal;
    }

    rest = hasAttached ? '' : rest;
  }

  return undefined;
}

function apply(
  reading: Reading,
  option: OptionSpec,
  { shown, attached }: Written,
): string | undefined {
  const { command } = reading.spec;

  if (option.kind === 'value') {
    const value = attached ?? reading.queue.shift();

    if (value === undefined) {
      return readerReasons.missingValue(command, shown);
    }

    reading.values.set(option.long, [...reading.values.get(option.long) ?? [], value]);

    return undefined;
  }

  const text = attached?.text ?? 'true';

  if (text !== 'true' && text !== 'false') {
    return readerReasons.badBoolean(command, shown);
  }

  reading.flags.set(option.long, text === 'true');

  return undefined;
}
