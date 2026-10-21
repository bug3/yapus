import { isSecretFile } from './is-secret-file.ts';
import { secretFiles } from './secret-files.ts';

// A reason to refuse a line the gate cannot split when its text names a file that
// holds secrets (matched on its whitespace-separated tokens), or undefined.
export function getUnreadableSecretRefusal(command: string): string | undefined {
  const file = command.split(/\s+/).find(isSecretFile);

  return file === undefined ? undefined : secretFiles.reasons.unreadable(file);
}
