import type { Call } from '../../calls/get-calls.ts';
import { destructiveCommands, type Matcher } from './destructive-commands.ts';
import { readArguments } from '../read-arguments.ts';

const MATCHERS: readonly Matcher[] = Object.values(destructiveCommands);

// A reason to refuse a git or gh command only a person should run, or undefined.
export function getDestructiveRefusal(call: Call): string | undefined {
  const texts = call.words.map((word) => word.text);

  for (const matcher of MATCHERS) {
    if (matcher.tool === call.tool && startsWith(texts, matcher.leading)
      && matcher.isMatch(readArguments(texts.slice(matcher.leading.length)))) {
      return matcher.reason;
    }
  }

  return getOpaqueRefusal(call, texts[0] ?? '');
}

function getOpaqueRefusal(call: Call, subcommand: string): string | undefined {
  const isGuarded = MATCHERS.some((matcher) => matcher.hasOpaqueGuard
    && matcher.tool === call.tool && matcher.leading[0] === subcommand);

  return isGuarded && call.words.slice(1).some((word) => word.isOpaque)
    ? `cannot judge \`git ${ subcommand }\` with an argument the gate cannot read`
    : undefined;
}

function startsWith(texts: readonly string[], leading: readonly string[]): boolean {
  return leading.every((text, index) => texts[index] === text);
}
