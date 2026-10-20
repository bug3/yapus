import type { Word } from '../../shell/split-commands.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { bypassCatalog } from './bypass-catalog.ts';

export interface ConfigArguments {
  readonly kind: 'arguments';
  // Long options by their full name, and each letter of a short group as `-x`.
  readonly flags: ReadonlySet<string>;
  // The words that are not options or option values, quoted opaque ones among them.
  readonly operands: readonly Word[];
}

export interface ConfigRefusal {
  readonly kind: 'refusal';
  readonly reason: string;
}

const LONG_OPTIONS: readonly string[] = [
  ...bypassCatalog.configValueOptions,
  ...bypassCatalog.configFlagOptions,
];

const WRITE_REFUSAL: ConfigRefusal = {
  kind: 'refusal',
  reason: bypassCatalog.reasons.configWrite,
};

// Reads the words after `config` against its option table. An unknown option, an
// option value the gate cannot read or a word the shell may split is refused.
export function readConfigArguments(words: readonly Word[]): ConfigArguments | ConfigRefusal {
  const flags = new Set<string>();
  const operands: Word[] = [];
  let isAfterDashes = false;
  let isValuePending = false;

  for (const word of words) {
    const { text } = word;

    if (isUnreadable(word)) {
      return { kind: 'refusal', reason: getUnreadableReason('git config') };
    }

    if (isValuePending) {
      if (word.isOpaque) {
        return WRITE_REFUSAL;
      }

      isValuePending = false;
    } else if (isAfterDashes || !text.startsWith('-') || text === '-') {
      operands.push(word);
    } else if (text === '--') {
      isAfterDashes = true;
    } else {
      const isPending = text.startsWith('--') ? addLong(text, flags) : addGroup(text, flags);

      if (isPending === undefined) {
        return WRITE_REFUSAL;
      }

      isValuePending = isPending;
    }
  }

  return { kind: 'arguments', flags, operands };
}

// Whether the option takes the next word as its value; undefined when unknown.
function addLong(text: string, flags: Set<string>): boolean | undefined {
  const [written = text, ...value] = text.split('=');
  const name = LONG_OPTIONS.includes(written)
    ? written
    : getOnly(LONG_OPTIONS.filter((option) => option.startsWith(written)));

  if (name === undefined) {
    return undefined;
  }

  flags.add(name);

  return value.length === 0 && bypassCatalog.configValueOptions.some((option) => option === name);
}

// Adds the letters of a short group up to a value-taking one; true when that
// letter ends the group, so the next word is its value; undefined for an unknown one.
function addGroup(text: string, flags: Set<string>): boolean | undefined {
  const letters = text.slice(1);
  let count = 0;

  for (const letter of letters) {
    count += 1;
    flags.add(`-${ letter }`);

    if (bypassCatalog.configValueLetters.includes(letter)) {
      return count === letters.length;
    }

    if (!bypassCatalog.configFlagLetters.includes(letter)) {
      return undefined;
    }
  }

  return false;
}

function getOnly(names: readonly string[]): string | undefined {
  return names.length === 1 ? names[0] : undefined;
}
