import type { Word } from '../../shell/split-commands.ts';
import type { Arguments } from '../read-arguments.ts';
import { pushCatalog } from './push-catalog.ts';

// Reads the words after `push`: the options (long ones resolved against the
// catalog, the letters of a short group as `-x`) and the operands. A value
// (`-o x`, `--repo=+x`) is never read as an option or an operand.
export function readPushArguments(words: readonly Word[]): Arguments {
  const flags = new Set<string>();
  const operands: string[] = [];
  let isAfterDashes = false;
  let isValuePending = false;

  for (const { text } of words) {
    if (isValuePending) {
      isValuePending = false;
    } else if (isAfterDashes || !text.startsWith('-') || text === '-') {
      operands.push(text);
    } else if (text === '--') {
      isAfterDashes = true;
    } else if (text.startsWith('--')) {
      isValuePending = addLong(text, flags);
    } else {
      isValuePending = addGroup(text, flags);
    }
  }

  return { flags, operands };
}

// The one option the text starts; else as written. A full option name that starts
// others (`--force`) is ambiguous here and so stays as written: that is the option.
function resolveLong(name: string): string {
  const matches = pushCatalog.longOptions
    .filter((option) => name.length > 2 && option.startsWith(name));

  return matches.length === 1 ? (matches[0] ?? name) : name;
}

// True when the option takes the next word as its value.
function addLong(text: string, flags: Set<string>): boolean {
  const [written = text, ...value] = text.split('=');
  const name = resolveLong(written);
  const opposite = pushCatalog.opposites.find((pair) => pair.name === name)?.opposite;

  if (opposite !== undefined) {
    flags.delete(opposite);
  }

  flags.add(name);

  return value.length === 0 && pushCatalog.valueOptions.some((option) => option === name);
}

// Adds the letters of a short group up to a value-taking one; true when that
// letter ends the group, so the next word is its value.
function addGroup(text: string, flags: Set<string>): boolean {
  const letters = text.slice(1);
  let count = 0;

  for (const letter of letters) {
    count += 1;

    if (pushCatalog.valueLetters.includes(letter)) {
      return count === letters.length;
    }

    flags.add(`-${ letter }`);
  }

  return false;
}
