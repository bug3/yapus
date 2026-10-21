import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ghCommands } from '../gh-commands.ts';
import { readLiteralValues } from '../options/read-literal-values.ts';
import type { GhArguments, GhRefusal } from '../read-gh-arguments.ts';

export interface BodyFile {
  readonly text: string;
}

const { reasons } = ghCommands;

// The text of the last `--body-file`, or a refusal when the call has none, the
// path is not literal or not absolute (`-` is standard input), or the file is
// not a UTF-8 file within the size limit.
export function readBodyFile(args: GhArguments, command: string): BodyFile | GhRefusal {
  const paths = readLiteralValues(args, command, 'body-file');

  if ('refusal' in paths) {
    return paths;
  }

  const path = paths.texts.at(-1);

  if (path === undefined) {
    return { refusal: reasons.missingOption(command, '--body-file') };
  }

  if (!isAbsolute(path)) {
    return { refusal: reasons.bodyFileNotAbsolute(command, path) };
  }

  const text = readBody(path);

  return text === undefined ? { refusal: reasons.bodyFileUnreadable(path) } : { text };
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
