import type { Word } from '../shell/split-commands.ts';
import { skipLeadWords } from './skip-lead-words.ts';

// What a command does to the working directory: nothing, a move to a directory
// as written, or a move this check cannot follow.
export type Cd =
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'to'; readonly directory: string };

export const UNKNOWN_CD: Cd = { kind: 'unknown' };

const NONE: Cd = { kind: 'none' };
const DIRECTORY_COMMANDS: readonly string[] = ['cd', 'pushd', 'popd'];

// Only `cd <literal dir>` is followed. Any other command that holds one of the
// directory commands as a word (`cd` alone, `cd -`, `{ cd x; }`, `pushd x`)
// may move it anywhere.
export function readCd(words: readonly Word[]): Cd {
  if (!words.some(({ text }) => DIRECTORY_COMMANDS.includes(text))) {
    return NONE;
  }

  const [name, target, ...extra] = skipLeadWords(words);
  const isPlainCd = name?.text === 'cd' && target !== undefined && target.isLiteral
    && target.text !== '' && !target.text.startsWith('-') && extra.length === 0;

  return isPlainCd ? { kind: 'to', directory: target.text } : UNKNOWN_CD;
}
