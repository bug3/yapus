import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readNameList } from './read-name-list.ts';

const EXECUTABLE = 0o755;
const SOURCE_EXTENSIONS = ['.ts', '.json'];

// Copies the hook files of the plugin at root into <home>/.claude/landmark/hooks,
// keeping the layout, and writes one stub per forwarded hook name; returns the
// paths. What is neither a source file nor JSON is a bash entry and runs.
export function writeHooks(home: string, root: string): string[] {
  const source = join(root, 'runtime');
  const target = join(home, '.claude', 'landmark', 'hooks');
  const files = readNameList(join(source, 'landmark', 'install', 'hook-files.json'));
  const names = readNameList(join(source, 'git', 'forward-names.json'));

  const copied = files.map((file) => {
    const path = join(target, file);

    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(join(source, file), path);

    if (!SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension))) {
      chmodSync(path, EXECUTABLE);
    }

    return path;
  });

  const stubs = names.map((name) => {
    const path = join(target, 'git', name);

    writeFileSync(path, makeStub(name), { mode: EXECUTABLE });
    chmodSync(path, EXECUTABLE);

    return path;
  });

  return [...copied, ...stubs];
}

function makeStub(name: string): string {
  return [
    '#!/usr/bin/env bash',
    'set -u',
    `exec bash "$(cd -P "$(dirname "\${BASH_SOURCE[0]}")" && pwd)/forward" ${ name } "$@"`,
    '',
  ].join('\n');
}
