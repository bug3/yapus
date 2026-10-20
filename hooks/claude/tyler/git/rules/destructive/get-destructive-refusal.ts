import type { Call } from '../../calls/get-calls.ts';
import { destructiveCommands, type Matcher } from './destructive-commands.ts';
import { readArguments } from '../read-arguments.ts';

const MATCHERS: readonly Matcher[] = Object.values(destructiveCommands);
const OPAQUE_GH_REASON = 'cannot judge `gh` with an argument the gate cannot read';

// A reason to refuse a git or gh command only a person should run, or undefined.
export function getDestructiveRefusal(call: Call): string | undefined {
  if (call.tool === 'gh' && call.words.slice(0, 2).some((word) => word.isOpaque)) {
    return OPAQUE_GH_REASON;
  }

  const texts = call.words.map((word) => word.text);

  for (const matcher of MATCHERS) {
    if (matcher.tool === call.tool && startsWith(texts, matcher.leading)
      && isMatching(matcher, texts.slice(matcher.leading.length))) {
      return matcher.reason;
    }
  }

  return getOpaqueRefusal(call, texts[0] ?? '');
}

function isMatching(matcher: Matcher, written: readonly string[]): boolean {
  return matcher.isMatch({ ...readArguments(written), written });
}

function getOpaqueRefusal(call: Call, subcommand: string): string | undefined {
  const isGuarded = MATCHERS.some((matcher) => matcher.hasOpaqueGuard
    && matcher.tool === call.tool && isNamed(matcher, call, subcommand));

  return isGuarded && call.words.slice(1).some((word) => word.isOpaque)
    ? `cannot judge \`${ call.tool } ${ subcommand }\` with an argument the gate cannot read`
    : undefined;
}

// A git matcher is named by its subcommand, since an unreadable word may hide the rest of
// its leading words; a gh call has its first two words read already.
function isNamed(matcher: Matcher, call: Call, subcommand: string): boolean {
  return call.tool === 'git'
    ? matcher.leading[0] === subcommand
    : startsWith(call.words.map((word) => word.text), matcher.leading);
}

function startsWith(texts: readonly string[], leading: readonly string[]): boolean {
  return leading.every((text, index) => texts[index] === text);
}
