import { chmodSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readNameList } from './read-name-list.ts';
import { swapDirectory } from './swap-directory.ts';

const EXECUTABLE = 0o755;
const SOURCE_EXTENSIONS = ['.ts', '.json'];

// Copies the hook files of the plugin at root into <home>/.claude/landmark/hooks,
// keeping the layout, and writes one stub per forwarded hook name; returns the
// paths. What is neither a source file nor JSON is a bash entry and runs.
// Everything is written into a staging directory beside the target and swapped
// in at the end, so a failure leaves the previous hooks directory as it was.
export function writeHooks(home: string, root: string): string[] {
  const source = join(root, 'runtime');
  const target = join(home, '.claude', 'landmark', 'hooks');
  const staging = `${ target }.new`;
  const files = readNameList(join(source, 'landmark', 'install', 'hook-files.json'));
  const names = readNameList(join(source, 'git', 'forward-names.json'));

  rmSync(staging, { recursive: true, force: true });

  try {
    files.forEach((file) => {
      copyHook(join(source, file), join(staging, file));
    });
    names.forEach((name) => {
      writeStub(join(staging, 'git', name), name);
    });
    swapDirectory(staging, target);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });

    throw error;
  }

  return [...files, ...names.map((name) => join('git', name))].map((file) => join(target, file));
}

function copyHook(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);

  if (!SOURCE_EXTENSIONS.some((extension) => to.endsWith(extension))) {
    chmodSync(to, EXECUTABLE);
  }
}

function writeStub(path: string, name: string): void {
  writeFileSync(path, makeStub(name), { mode: EXECUTABLE });
  chmodSync(path, EXECUTABLE);
}

function makeStub(name: string): string {
  return [
    '#!/usr/bin/env bash',
    'set -u',
    `exec bash "$(cd -P "$(dirname "\${BASH_SOURCE[0]}")" && pwd)/forward" ${ name } "$@"`,
    '',
  ].join('\n');
}
