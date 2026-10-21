import type { Word } from '../../shell/split-commands.ts';
import { ghCommands } from './gh-commands.ts';

// The command and action a gh call names, as the catalog spells them (`pr create`
// for `pr new`); the words after them are its arguments.
export function getGhAction(words: readonly Word[]): string {
  const written = words.slice(0, 2).map(({ text }) => text).join(' ');

  return ghCommands.aliases.get(written) ?? written;
}
