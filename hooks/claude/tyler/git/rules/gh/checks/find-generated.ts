import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from '../../../context/make-context.ts';
import type { RunResult } from '../../../context/run.ts';
import { getFailureDetail } from './get-failure-detail.ts';
import { sizeCatalog } from './size-catalog.ts';

export interface Generated {
  readonly paths: ReadonlySet<string>;
}

export interface GeneratedRefusal {
  readonly refusal: string;
}

const { reasons, oldGit } = sizeCatalog;

// The refusal for a git run of the size check that did not give its answer: git too
// old for the attribute source option, else a failure worth a retry.
export function getMeasureRefusal(result: RunResult): string {
  const isOldGit = !('failure' in result)
    && result.status === oldGit.status
    && oldGit.stderr.test(result.stderr);

  return isOldGit ? reasons.oldGit : reasons.cannotMeasure(getFailureDetail(result));
}

const LOCAL = 'info/attributes';

// Which of the paths (relative to the repository root, as `git diff` writes them)
// have the generated attribute set in the base commit, so that a pull request cannot
// exempt its own files by adding a .gitattributes. One `git check-attr` call reads
// them all, with no global or system attributes file and no replaced objects; the
// paths go in absolute, since git reads a relative one from the working directory.
// A repository with anything at its own info/attributes path (anyone with write
// access to .git may have put it there) cannot be measured: those attributes reach
// `git diff` too, and could make every file count as 0 lines.
export function findGenerated(
  context: Context,
  paths: readonly string[],
  base: string,
): Generated | GeneratedRefusal {
  if (paths.length === 0) {
    return { paths: new Set() };
  }

  const top = context.run('git', ['rev-parse', '--show-toplevel']);
  const local = context.run('git', ['rev-parse', '--path-format=absolute', '--git-path', LOCAL]);

  if ('failure' in top || top.status !== 0) {
    return { refusal: reasons.cannotMeasure(getFailureDetail(top)) };
  }

  if ('failure' in local || local.status !== 0) {
    return { refusal: reasons.cannotMeasure(getFailureDetail(local)) };
  }

  if (isPresent(local.stdout.trim())) {
    return { refusal: reasons.localAttributes(local.stdout.trim()) };
  }

  const root = top.stdout.trim();
  const absolute = new Map(paths.map((path) => [join(root, path), path]));
  const input = [...absolute.keys()].map((path) => `${ path }\0`).join('');
  const result = context.run(
    'git',
    [
      '--no-replace-objects', '-c', 'core.attributesFile=/dev/null',
      'check-attr', `--source=${ base }`, '--stdin', '-z', sizeCatalog.generatedAttribute,
    ],
    { input, env: sizeCatalog.attributesEnv },
  );

  if ('failure' in result || result.status !== 0) {
    return { refusal: getMeasureRefusal(result) };
  }

  // The output is "<path>\0<attribute>\0<value>\0" for each path.
  const fields = result.stdout.split('\0');
  const generated = new Set<string>();

  for (let index = 0; index + 2 < fields.length; index += 3) {
    const path = absolute.get(fields[index] ?? '');
    const value = fields[index + 2] ?? '';

    if (path !== undefined && sizeCatalog.generatedValues.some((set) => set === value)) {
      generated.add(path);
    }
  }

  return { paths: generated };
}

// Only a path git reports as missing is absent: a file of any size, a link, a
// directory or a path that cannot be examined is present.
function isPresent(path: string): boolean {
  try {
    lstatSync(path);

    return true;
  } catch (error) {
    return !(error instanceof Error && 'code' in error && error.code === 'ENOENT');
  }
}
