import { isAbsolute, resolve } from 'node:path';
import type { Split } from '../shell/split-commands.ts';
import { readCd, UNKNOWN_CD, type Cd } from './read-cd.ts';
import { readGhCall, type GhCall } from './read-gh-call.ts';

export interface PlacedGhCall extends GhCall {
  // The directory the call runs in, or undefined when it cannot be told.
  readonly cwd: string | undefined;
}

interface Walk {
  readonly cwd: string | undefined;
  readonly calls: readonly PlacedGhCall[];
}

// The gh calls a command line makes, in order, each with the directory it runs
// in: `cwd`, moved by each `cd` before it.
export function findGhCalls(split: Split, cwd: string): readonly PlacedGhCall[] {
  const walk = split.commands.reduce<Walk>((before, words, index) => {
    const call = readGhCall(words);
    const cd = readCd(words);
    // A `cd` in a subshell or a pipeline moves only itself.
    const isIsolatedCd = cd.kind !== 'none' && split.isolated[index] === true;

    return {
      cwd: getNextCwd(before.cwd, isIsolatedCd ? UNKNOWN_CD : cd),
      calls: call === undefined ? before.calls : [...before.calls, { ...call, cwd: before.cwd }],
    };
  }, { cwd, calls: [] });

  return walk.calls;
}

function getNextCwd(cwd: string | undefined, cd: Cd): string | undefined {
  switch (cd.kind) {
    case 'none':
      return cwd;
    case 'unknown':
      return undefined;
    case 'to':
      if (isAbsolute(cd.directory)) {
        return cd.directory;
      }

      return cwd === undefined ? undefined : resolve(cwd, cd.directory);
  }
}
