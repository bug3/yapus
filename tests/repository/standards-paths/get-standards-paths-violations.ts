import { join } from 'node:path';
import { listFiles } from '../../helpers/list-files.ts';
import { readUtf8 } from '../../helpers/read-utf8.ts';

// The standards CLAUDE.md imports, so they load in every session and carry
// no paths frontmatter; every other standard loads by path and carries one.
const ALWAYS_LOADED: readonly string[] = ['standards/PRINCIPLES.md'];
const STANDARDS = 'standards/';
const FENCE = '---';
const PATHS_KEY = 'paths:';
// One glob entry, quoted, as Claude Code reads it.
const PATHS_ENTRY = /^ {2}- "[^"]+"$/;

// Every standard whose head does not match where it loads, as
// "<path>: <what is wrong>", relative to root.
export function getStandardsPathsViolations(root: string): string[] {
  return listFiles(root, '.md')
    .filter((path) => path.startsWith(STANDARDS))
    .flatMap((path) => getViolation(root, path));
}

function getViolation(root: string, path: string): string[] {
  const text = readUtf8(join(root, path));

  if (text === undefined) {
    return [`${ path }: not UTF-8 text`];
  }

  const hasFrontmatter = isPathsFrontmatter(text.split('\n'));

  if (ALWAYS_LOADED.includes(path)) {
    return hasFrontmatter ? [`${ path }: has paths frontmatter but loads always`] : [];
  }

  return hasFrontmatter ? [] : [`${ path }: no paths frontmatter`];
}

// A head of the form: a fence, the paths key, one or more entries, a fence.
function isPathsFrontmatter(lines: readonly string[]): boolean {
  if (lines[0] !== FENCE || lines[1] !== PATHS_KEY) {
    return false;
  }

  const entryCount = lines.slice(2).findIndex((line) => !PATHS_ENTRY.test(line));

  return entryCount > 0 && lines[2 + entryCount] === FENCE;
}
