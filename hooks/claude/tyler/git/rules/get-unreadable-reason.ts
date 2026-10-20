import type { Word } from '../shell/split-commands.ts';

// Visible first characters that make a word an option or a forced refspec.
const SIGNIFICANT_STARTS = ['-', '+'];

// The one policy for a word the gate cannot read. A quoted one is one word, read
// as an operand or a value and never as an option; one the shell may split could
// be several words, options among them, and one that visibly starts with `-` or `+`
// is an option or a forced refspec of unknown value, so a rule that judges the
// arguments refuses either.
export function isUnreadable(word: Word): boolean {
  return word.isOpaque
    && (word.canSplit || SIGNIFICANT_STARTS.some((start) => word.text.startsWith(start)));
}

// The reason to refuse `command` (`git push`) for a word it cannot read.
export function getUnreadableReason(command: string): string {
  return `cannot judge \`${ command }\` with an argument the gate cannot read; `
    + 'quote it if it is one word, and start it with neither - nor +';
}
