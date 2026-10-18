import { join } from 'node:path';
import { listAllFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

const BASH_SHEBANG = '#!/usr/bin/env bash\n';
const FIRST_COMMAND = 'set -u';
// `set -e`, `set -eu`, `set -o errexit` and the like, at a line's start.
const ERREXIT = /^\s*set\s+(?:-[a-zA-Z]*e[a-zA-Z]*|-o\s+errexit)\b/;
const BLANK_OR_COMMENT = /^\s*(?:#.*)?$/;

// Every bash script under root whose first command is not `set -u` or that
// turns `set -e` on, as "<path>: <what is wrong>".
export function getSetUViolations(root: string): string[] {
  return listAllFiles(root).flatMap((path) => {
    const text = readUtf8(join(root, path)) ?? '';

    return text.startsWith(BASH_SHEBANG) ? getViolations(path, text.split('\n')) : [];
  });
}

function getViolations(path: string, lines: readonly string[]): string[] {
  const firstCommand = lines.slice(1).find((line) => !BLANK_OR_COMMENT.test(line));
  const errexitIndex = lines.findIndex((line) => ERREXIT.test(line));
  const commandViolations = firstCommand === FIRST_COMMAND
    ? []
    : [`${ path }: first command is not ${ FIRST_COMMAND }`];
  const errexitViolations = errexitIndex === -1
    ? []
    : [`${ path }:${ String(errexitIndex + 1) }: turns set -e on`];

  return [...commandViolations, ...errexitViolations];
}
