import type { Call } from '../../calls/get-calls.ts';
import type { Word } from '../../shell/split-commands.ts';
import {
  getUnreadableReason,
  isUnreadable,
  startsWithExpansion,
} from '../get-unreadable-reason.ts';
import { ghCommands } from './gh-commands.ts';

const { reasons, writes } = ghCommands;

const LABEL_WRITES: readonly string[] = writes.labelActions;
const FIELD_OPTIONS: readonly string[] = writes.fieldOptions;

// What a scan of the words after `gh api` found. A value of an option is never
// read as an option or an operand.
interface Scan {
  readonly queue: Word[];
  readonly methods: Word[];
  readonly operands: Word[];
  hasField: boolean;
}

// A reason to refuse a `gh api` that may write or post, or a `gh label` that
// changes labels, or undefined. Only the options that decide a write are looked
// for, so every other option of `gh api` passes.
export function getGhWriteRefusal(call: Call): string | undefined {
  const [command, action] = call.words;

  if (call.tool !== 'gh') {
    return undefined;
  }

  if (command?.text === 'label' && action !== undefined && LABEL_WRITES.includes(action.text)) {
    return reasons.labelWrite(action.text);
  }

  return command?.text === 'api' ? getApiRefusal(call.words.slice(1)) : undefined;
}

function getApiRefusal(words: readonly Word[]): string | undefined {
  if (words.some(isUnreadable)) {
    return getUnreadableReason('gh api');
  }

  if (words.some(startsWithExpansion)) {
    return reasons.apiExpansion;
  }

  const scan = scanApi(words);

  if (scan.operands[0] !== undefined && isGraphql(scan.operands[0])) {
    return reasons.apiGraphql;
  }

  if (scan.methods.some(isWrite)) {
    return reasons.apiMethod;
  }

  return scan.methods.length === 0 && scan.hasField ? reasons.apiFields : undefined;
}

function scanApi(words: readonly Word[]): Scan {
  const scan: Scan = { queue: [...words], methods: [], operands: [], hasField: false };
  let isAfterDashes = false;

  for (let word = scan.queue.shift(); word !== undefined; word = scan.queue.shift()) {
    const { text } = word;

    if (isAfterDashes || !text.startsWith('-') || text === '-') {
      scan.operands.push(word);
    } else if (text === '--') {
      isAfterDashes = true;
    } else if (text.startsWith('--')) {
      scanLong(scan, word);
    } else {
      scanShortGroup(scan, word);
    }
  }

  return scan;
}

// `--name value` or `--name=value`.
function scanLong(scan: Scan, word: Word): void {
  const equals = word.text.indexOf('=');
  const name = (equals < 0 ? word.text : word.text.slice(0, equals)).slice(2);
  const option = writes.apiValueOptions.find(({ long }) => long === name);

  if (option !== undefined) {
    const attached = equals < 0 ? undefined : { ...word, text: word.text.slice(equals + 1) };

    takeValue(scan, option.long, attached ?? scan.queue.shift());
  }
}

// Flag letters, then at most one value letter: `-X POST`, `-XPOST`, `-iX=POST`.
function scanShortGroup(scan: Scan, word: Word): void {
  const letters = word.text.slice(1);

  for (let index = 0; index < letters.length; index += 1) {
    const option = writes.apiValueOptions.find(({ short }) => short === letters[index]);

    if (option !== undefined) {
      const rest = letters.slice(index + 1);
      const text = rest.startsWith('=') ? rest.slice(1) : rest;

      takeValue(scan, option.long, rest === '' ? scan.queue.shift() : { ...word, text });

      return;
    }
  }
}

function takeValue(scan: Scan, long: string, value: Word | undefined): void {
  if (FIELD_OPTIONS.includes(long)) {
    scan.hasField = true;
  }

  if (long === writes.methodOption && value !== undefined) {
    scan.methods.push(value);
  }
}

// Whether the endpoint ends in the segment `graphql`, in any case: `graphql`,
// `/graphql`, `https://api.github.com/graphql`.
function isGraphql({ text }: Word): boolean {
  const path = text.split(/[?#]/u)[0] ?? text;
  const segment = path.split('/').filter((part) => part !== '').at(-1) ?? '';

  return segment.toLowerCase() === writes.graphqlOperand;
}

// A method the gate cannot read may be a write.
function isWrite(method: Word): boolean {
  return method.isOpaque || method.text.toUpperCase() !== writes.readMethod;
}
