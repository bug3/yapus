import type { Call } from '../../calls/get-calls.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import { type Arguments, hasFlag, readArguments } from '../read-arguments.ts';
import { getKeyRefusal } from './get-key-refusal.ts';
import { readCommitArguments } from './read-commit-arguments.ts';

// A reason to refuse a git call that skips the hooks, or undefined.
export function getBypassRefusal(call: Call): string | undefined {
  if (call.tool !== 'git') {
    return undefined;
  }

  const { hooksPathKey } = bypassCatalog;

  if (call.configs.some((config) => config.text.toLowerCase().includes(hooksPathKey))) {
    return bypassCatalog.reasons.hooksPath;
  }

  for (const config of call.configs) {
    const reason = getKeyRefusal(config.text.split('=')[0] ?? '');

    if (reason !== undefined) {
      return reason;
    }
  }

  if (call.assignments.some((name) => name.startsWith(bypassCatalog.environmentConfigPrefix))) {
    return bypassCatalog.reasons.configEnvironment;
  }

  const subcommand = call.words[0]?.text ?? '';

  if (subcommand === 'config') {
    return getConfigRefusal(call);
  }

  const reason = Object.entries(bypassCatalog.noVerifyReasons)
    .find(([name]) => name === subcommand)?.[1];

  return reason === undefined ? undefined : getSubcommandRefusal(call, subcommand, reason);
}

function getSubcommandRefusal(
  call: Call,
  subcommand: string,
  noVerifyReason: string,
): string | undefined {
  const rest = call.words.slice(1);
  const opaqueReason =
    `cannot judge \`git ${ subcommand }\` with an argument the gate cannot read`;

  if (subcommand === 'commit') {
    const args = readCommitArguments(rest);

    if (hasFlag(args, '--no-verify') || hasFlag(args, '-n')) {
      return noVerifyReason;
    }

    return args.hasStrayOpaque ? opaqueReason : undefined;
  }

  if (hasFlag(readArguments(literalTexts(rest)), '--no-verify')) {
    return noVerifyReason;
  }

  const isOpaqueRefused = bypassCatalog.opaqueSubcommands.some((name) => name === subcommand);

  return isOpaqueRefused && rest.some((word) => word.isOpaque) ? opaqueReason : undefined;
}

function getConfigRefusal(call: Call): string | undefined {
  const rest = call.words.slice(1);

  if (rest.some((word) => word.isOpaque)) {
    return bypassCatalog.reasons.configWrite;
  }

  const texts = literalTexts(rest);
  const args = readArguments(texts);

  if (hasAnyFlag(args, bypassCatalog.configEditFlags) || removesCore(args)) {
    return bypassCatalog.reasons.configWrite;
  }

  const isRead = hasAnyFlag(args, bypassCatalog.configReadFlags)
    || bypassCatalog.configReadSubcommands.some((name) => name === texts[0]);

  if (isRead) {
    return undefined;
  }

  const [first, second] = args.operands;
  const isKeyAfterSubcommand = bypassCatalog.configKeySubcommands.some((name) => name === first);

  return getKeyRefusal((isKeyAfterSubcommand ? second : first) ?? '');
}

function removesCore(args: Arguments): boolean {
  return hasAnyFlag(args, bypassCatalog.configSectionFlags)
    && args.operands.some((operand) => operand.toLowerCase() === 'core');
}

function hasAnyFlag(args: Arguments, flags: readonly string[]): boolean {
  return flags.some((flag) => hasFlag(args, flag));
}

function literalTexts(words: Call['words']): string[] {
  return words.filter((word) => !word.isOpaque).map((word) => word.text);
}
