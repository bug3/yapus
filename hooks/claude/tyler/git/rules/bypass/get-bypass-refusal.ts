import type { Call } from '../../calls/get-calls.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import { type Arguments, hasFlag, readArguments } from '../read-arguments.ts';
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

  return reason !== undefined && skipsVerify(call, subcommand) ? reason : undefined;
}

function skipsVerify(call: Call, subcommand: string): boolean {
  const rest = call.words.slice(1);

  if (subcommand === 'commit') {
    const args = readCommitArguments(rest);

    return hasFlag(args, '--no-verify') || hasFlag(args, '-n');
  }

  return hasFlag(readArguments(literalTexts(rest)), '--no-verify');
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
  const isHooksPath = texts.some((text) => text.toLowerCase() === bypassCatalog.hooksPathKey);

  if (isRead) {
    return undefined;
  }

  const keyReason = texts.map(getKeyRefusal).find((reason) => reason !== undefined);

  return isHooksPath ? bypassCatalog.reasons.hooksPath : keyReason;
}

// A reason to refuse setting this configuration key, or undefined.
function getKeyRefusal(key: string): string | undefined {
  const lower = key.toLowerCase();

  if (lower.startsWith(bypassCatalog.aliasKeyPrefix)) {
    return bypassCatalog.reasons.aliasConfig;
  }

  return lower === bypassCatalog.cleanRequireForceKey
    ? bypassCatalog.reasons.cleanRequireForceConfig
    : undefined;
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
