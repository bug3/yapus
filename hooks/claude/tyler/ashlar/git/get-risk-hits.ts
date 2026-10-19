import { matchesGlob } from 'node:path';
import type { Range } from './get-change.ts';
import { getOutput, type GitFailure, isFailure, type Place } from './run-git.ts';

export interface RiskHit {
  readonly file: string;
  readonly glob: string;
}

const GLOBS_PATH = '.claude/ashlar-paths';

// For each file, in order, the first risk glob that matches it; a file that
// matches none gives nothing. The globs are the lines of .claude/ashlar-paths
// at range.base and at range.tree together: the tree is the session's working
// tree, so a session can add a glob but cannot remove one. A git failure comes
// back as a value.
export function getRiskHits(
  place: Place,
  range: Range,
  files: readonly string[],
): readonly RiskHit[] | GitFailure {
  const atBase = getGlobs(place, range.base);
  const atTree = getGlobs(place, range.tree);

  if (isFailure(atBase)) {
    return atBase;
  }

  if (isFailure(atTree)) {
    return atTree;
  }

  const globs = [...new Set([...atBase, ...atTree])];

  return files.flatMap((file) => {
    const glob = globs.find((candidate) => matchesGlob(file, candidate));

    return glob === undefined ? [] : [{ file, glob }];
  });
}

// The non-blank, trimmed lines of the globs file in the treeish; an absent file
// gives none.
function getGlobs(place: Place, treeish: string): readonly string[] | GitFailure {
  // --full-tree reads GLOBS_PATH from the root even when place.cwd is deeper.
  const listing = getOutput(['ls-tree', '--full-tree', treeish, '--', GLOBS_PATH], place);

  if (isFailure(listing)) {
    return listing;
  }

  if (listing === '') {
    return [];
  }

  const content = getOutput(['cat-file', 'blob', `${ treeish }:${ GLOBS_PATH }`], place);

  if (isFailure(content)) {
    return content;
  }

  return content.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}
