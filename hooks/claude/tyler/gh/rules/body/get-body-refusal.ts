import type { BodyRules } from '../gh-commands.ts';
import type { GhArguments } from '../read-gh-arguments.ts';
import { getBodyTextRefusal } from './get-body-text-refusal.ts';
import { readBodyFile } from './read-body-file.ts';

// What the body of a call is judged by: its action's command, the rules of its
// body, and the directory a relative `--body-file` resolves against, undefined
// when it cannot be told.
export interface BodyCheck {
  readonly command: string;
  readonly rules: BodyRules;
  readonly cwd: string | undefined;
}

// A reason to refuse a call whose `--body-file` is missing, not a readable file,
// or whose text does not follow the rules, or undefined.
export function getBodyRefusal(args: GhArguments, check: BodyCheck): string | undefined {
  const file = readBodyFile(args, check.command, check.cwd);

  return 'refusal' in file ? file.refusal : getBodyTextRefusal(file.text, check.rules);
}
