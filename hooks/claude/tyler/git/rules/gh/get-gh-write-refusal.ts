import type { Call } from '../../calls/get-calls.ts';
import type { Word } from '../../shell/split-commands.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { ghCommands } from './gh-commands.ts';

const { reasons, writes } = ghCommands;

const LABEL_WRITES: readonly string[] = writes.labelActions;
const FIELD_OPTIONS: readonly string[] = writes.fieldOptions;

// A reason to refuse a `gh api` that may write or post, or a `gh label` that
// changes labels, or undefined. The words of `gh api` are scanned, not read as
// options, so every option the scan does not look for passes.
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

  if (words.some(({ text }) => text === writes.graphqlOperand)) {
    return reasons.apiGraphql;
  }

  const methods = words.flatMap((word, index) => readMethod(word, words[index + 1]) ?? []);

  if (methods.some(isWrite)) {
    return reasons.apiMethod;
  }

  return methods.length === 0 && words.some(isFieldOption) ? reasons.apiFields : undefined;
}

function startsWithExpansion({ isOpaque, text }: Word): boolean {
  return isOpaque && (text.startsWith('$') || text.startsWith('`'));
}

// The method written by `-X POST`, `-XPOST`, `--method POST` or `--method=POST`.
function readMethod(word: Word, next: Word | undefined): Word | undefined {
  const { text } = word;

  if (text === writes.methodOption) {
    return next;
  }

  if (text.startsWith(`${ writes.methodOption }=`)) {
    return { ...word, text: text.slice(writes.methodOption.length + 1) };
  }

  const letter = text.startsWith('-') && !text.startsWith('--')
    ? text.indexOf(writes.methodLetter)
    : -1;

  if (letter < 0) {
    return undefined;
  }

  return letter === text.length - 1 ? next : { ...word, text: text.slice(letter + 1) };
}

// A method the gate cannot read may be a write.
function isWrite(method: Word): boolean {
  return method.isOpaque || method.text.toUpperCase() !== writes.readMethod;
}

function isFieldOption({ text }: Word): boolean {
  const name = text.split('=')[0] ?? text;

  return FIELD_OPTIONS.includes(name) || writes.shortFieldGroup.test(text);
}
