import type { Call } from '../../calls/get-calls.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import { getUnreadableReason, isUnreadable } from '../get-unreadable-reason.ts';
import { hasFlag, readArguments } from '../read-arguments.ts';
import { getCloneRefusal } from './get-clone-refusal.ts';
import { getConfigRefusal } from './get-config-refusal.ts';
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
    return getConfigRefusal(call.words.slice(1));
  }

  const cloneReason = getCloneRefusal(subcommand, call.words.slice(1));

  if (cloneReason !== undefined) {
    return cloneReason;
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
  const opaqueReason = getUnreadableReason(`git ${ subcommand }`);

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

  return isOpaqueRefused && rest.some(isUnreadable) ? opaqueReason : undefined;
}

function literalTexts(words: Call['words']): string[] {
  return words.filter((word) => !word.isOpaque).map((word) => word.text);
}
