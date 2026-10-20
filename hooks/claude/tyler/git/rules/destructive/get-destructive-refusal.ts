import type { Call } from '../../calls/get-calls.ts';
import { destructiveCommands, type Matcher } from './destructive-commands.ts';
import type { Word } from '../../shell/split-commands.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { readArguments } from '../read-arguments.ts';

const MATCHERS: readonly Matcher[] = Object.values(destructiveCommands);
const OPAQUE_GH_REASON = 'cannot judge `gh` with an argument the gate cannot read';

// A reason to refuse a git or gh command only a person should run, or undefined.
export function getDestructiveRefusal(call: Call): string | undefined {
  if (call.tool === 'gh' && call.words.slice(0, 2).some((word) => word.isOpaque)) {
    return OPAQUE_GH_REASON;
  }

  const texts = textsOf(call.words);

  for (const matcher of MATCHERS) {
    if (matcher.tool === call.tool && startsWith(texts, matcher.leading)
      && isMatching(matcher, call.words.slice(matcher.leading.length))) {
      return matcher.reason;
    }
  }

  return getOpaqueRefusal(call, texts[0] ?? '');
}

function isMatching(matcher: Matcher, written: readonly Word[]): boolean {
  return matcher.isMatch({ ...readArguments(textsOf(written)), written });
}

function textsOf(words: readonly Word[]): string[] {
  return words.map((word) => word.text);
}

// A named command is refused for an opaque word where its leading words stand, or
// for a word after them that the shell may split; a quoted one is an operand.
function getOpaqueRefusal(call: Call, subcommand: string): string | undefined {
  const isGuarded = MATCHERS.some((matcher) => matcher.tool === call.tool
    && isNamed(matcher, call, subcommand) && hasOpaqueWord(matcher, call.words));

  return isGuarded ? getUnreadableReason(`${ call.tool } ${ subcommand }`) : undefined;
}

function hasOpaqueWord(matcher: Matcher, words: readonly Word[]): boolean {
  const { length } = matcher.leading;

  return words.slice(1, length).some((word) => word.isOpaque)
    || words.slice(length).some(isUnreadable);
}

// A git matcher is named by its subcommand, since an unreadable word may hide the rest of
// its leading words; a gh call has its first two words read already.
function isNamed(matcher: Matcher, call: Call, subcommand: string): boolean {
  return call.tool === 'git'
    ? matcher.leading[0] === subcommand
    : startsWith(textsOf(call.words), matcher.leading);
}

function startsWith(texts: readonly string[], leading: readonly string[]): boolean {
  return leading.every((text, index) => texts[index] === text);
}
