import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ghCommands, type BodyRules } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { getBodyTextRefusal } from './get-body-text-refusal.ts';

const { reasons } = ghCommands;

// A reason to refuse a call whose `--body-file` is missing, not an absolute path
// to a readable file, or whose text does not follow the rules, or undefined.
export function getBodyRefusal(
  args: GhArguments,
  command: string,
  rules: BodyRules,
): string | undefined {
  const paths = readLiteralValues(args, command, 'body-file');

  if ('refusal' in paths) {
    return paths.refusal;
  }

  const path = paths.texts.at(-1);

  if (path === undefined) {
    return reasons.missingOption(command, '--body-file');
  }

  if (!isAbsolute(path)) {
    return reasons.bodyFileNotAbsolute(command, path);
  }

  const text = readBody(path);

  return text === undefined ? reasons.bodyFileUnreadable(path) : getBodyTextRefusal(text, rules);
}

function readBody(path: string): string | undefined {
  try {
    const stats = statSync(path);

    return stats.isFile() && stats.size <= ghCommands.maxBodyBytes
      ? new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path))
      : undefined;
  } catch {
    return undefined;
  }
}
