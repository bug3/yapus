import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface BodyFile {
  readonly text: string;
}

const { reasons } = ghCommands;
const STDIN = '-';
const MISSING = 'ENOENT';

// The text of the last `--body-file`, or a refusal when the call has none, the
// path is not literal, is `-` (standard input), is relative to a directory that
// cannot be told, or the file is missing or not a UTF-8 file within the size limit.
// The hook runs before the command, so the file must already be written.
export function readBodyFile(
  args: GhArguments,
  command: string,
  cwd: string | undefined,
): BodyFile | GhRefusal {
  const paths = readLiteralValues(args, command, 'body-file');

  if ('refusal' in paths) {
    return paths;
  }

  const written = paths.texts.at(-1);

  if (written === undefined) {
    return { refusal: reasons.missingOption(command, '--body-file') };
  }

  if (written === STDIN) {
    return { refusal: reasons.bodyFileStdin(command) };
  }

  if (cwd === undefined && !isAbsolute(written)) {
    return { refusal: reasons.bodyFileUnknownCwd(command, written) };
  }

  return readBody(resolve(cwd ?? '/', written));
}

function readBody(path: string): BodyFile | GhRefusal {
  try {
    const stats = statSync(path);

    return stats.isFile() && stats.size <= ghCommands.maxBodyBytes
      ? { text: new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path)) }
      : { refusal: reasons.bodyFileUnreadable(path) };
  } catch (error) {
    const reason = isMissing(error) ? reasons.bodyFileMissing : reasons.bodyFileUnreadable;

    return { refusal: reason(path) };
  }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === MISSING;
}
