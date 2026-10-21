import type { BodyRules } from '../gh-commands.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { getBodyTextRefusal } from './get-body-text-refusal.ts';
import { readBodyFile } from './read-body-file.ts';

// A reason to refuse a call whose `--body-file` is missing, not an absolute path
// to a readable file, or whose text does not follow the rules, or undefined.
export function getBodyRefusal(
  args: GhArguments,
  command: string,
  rules: BodyRules,
): string | undefined {
  const file = readBodyFile(args, command);

  return 'refusal' in file ? file.refusal : getBodyTextRefusal(file.text, rules);
}
