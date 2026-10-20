import type { Word } from '../../shell/split-commands.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import { getDeniedKeyRefusal, getKeyRefusal } from './get-key-refusal.ts';
import { readConfigArguments } from './read-config-arguments.ts';

// A reason to refuse the `git config` call with these words after `config`, or
// undefined. A read passes; a write passes only for an allowed key.
export function getConfigRefusal(words: readonly Word[]): string | undefined {
  const { reasons } = bypassCatalog;

  // A backstop under the reading below: no `git config` call names core.hooksPath.
  if (words.some((word) => !word.isOpaque && isHooksPath(word.text))) {
    return reasons.hooksPath;
  }

  const args = readConfigArguments(words);

  if (args.kind === 'refusal') {
    return args.reason;
  }

  const [first] = args.operands;
  const subcommand = first === undefined || first.isOpaque ? '' : first.text;
  const isRefused = bypassCatalog.configRefusedFlags.some((flag) => args.flags.has(flag))
    || bypassCatalog.configRefusedSubcommands.some((name) => name === subcommand);

  if (isRefused) {
    return reasons.configWrite;
  }

  // `git config key` with no value reads the key, unless an option unsets it;
  // only when the gate reads every word.
  const isLoneKey = args.operands.length === 1
    && words.every((word) => !word.isOpaque)
    && !bypassCatalog.configKeySubcommands.some((name) => name === subcommand)
    && !bypassCatalog.configUnsetFlags.some((flag) => args.flags.has(flag));
  const isRead = isLoneKey
    || bypassCatalog.configReadFlags.some((flag) => args.flags.has(flag))
    || bypassCatalog.configReadSubcommands.some((name) => name === subcommand);

  if (isRead) {
    return undefined;
  }

  const hasKeySubcommand = bypassCatalog.configKeySubcommands.some((name) => name === subcommand);

  return getWriteRefusal(hasKeySubcommand ? args.operands.slice(1) : args.operands);
}

// `key value [value-pattern]`: an allowed literal key, and no operand that names a
// denied key.
function getWriteRefusal(operands: readonly Word[]): string | undefined {
  const [key] = operands;

  if (key === undefined) {
    return undefined;
  }

  if (key.isOpaque || operands.length > bypassCatalog.maxConfigWriteOperands) {
    return bypassCatalog.reasons.configWrite;
  }

  const denied = operands
    .filter((operand) => !operand.isOpaque)
    .map((operand) => getDeniedKeyRefusal(operand.text))
    .find((reason) => reason !== undefined);

  return getKeyRefusal(key.text) ?? denied;
}

function isHooksPath(text: string): boolean {
  return text.toLowerCase() === bypassCatalog.hooksPathKey;
}
