import { isSecretFile } from './is-secret-file.ts';
import { secretFiles } from './secret-files.ts';

// Whitespace, the characters a shell reads as operators or quotes, and `=`.
const TOKEN_BREAKS = /[\s<>|;&()$`'"=]+/;

// A reason to refuse a line the gate cannot split when its text names a file that
// holds secrets (matched on its tokens, cut at blanks and shell metacharacters), or
// undefined.
export function getUnreadableSecretRefusal(command: string): string | undefined {
  const file = command.split(TOKEN_BREAKS).find(isSecretFile);

  return file === undefined ? undefined : secretFiles.reasons.unreadable(file);
}
