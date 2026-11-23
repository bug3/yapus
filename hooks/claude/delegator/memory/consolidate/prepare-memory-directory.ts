import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../../shared/get-first-line.ts';
import { DIRECTORIES, getMemoryDirectory } from '../get-memory-directory.ts';

const IGNORE_FILE = '.gitignore';
const IGNORE_ALL = '*\n';

export type Prepared =
  | { readonly kind: 'created' }
  | { readonly kind: 'present' }
  | { readonly kind: 'failure'; readonly detail: string };

// Creates what the project's memory directory lacks: the directory, its three
// directories and an ignore file that keeps it out of git. Nothing that
// exists is changed: the person edits the ignore file to commit the memory.
// Created, when the directory itself was not there before. A project root
// that is no directory fails, so a mistyped path creates nothing.
export function prepareMemoryDirectory(projectRoot: string): Prepared {
  const memoryDirectory = getMemoryDirectory(projectRoot);

  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
    return {
      kind: 'failure',
      detail: `${ projectRoot } is not a directory; give the absolute path of the project, `
        + 'nothing changed',
    };
  }

  const isCreated = !existsSync(memoryDirectory);

  try {
    for (const directory of DIRECTORIES) {
      mkdirSync(join(memoryDirectory, directory), { recursive: true });
    }

    writeIgnoreFile(memoryDirectory);
  } catch (error) {
    return {
      kind: 'failure',
      detail: `cannot create ${ memoryDirectory }: ${ getFirstLine(error) }; `
        + 'repair it and run the command again',
    };
  }

  return { kind: isCreated ? 'created' : 'present' };
}

function writeIgnoreFile(memoryDirectory: string): void {
  try {
    writeFileSync(join(memoryDirectory, IGNORE_FILE), IGNORE_ALL, { flag: 'wx' });
  } catch (error) {
    if (!isExisting(error)) {
      throw error;
    }
  }
}

function isExisting(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}
