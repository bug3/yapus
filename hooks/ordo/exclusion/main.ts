import { statSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { getExclusionPath } from '../../shared/exclusion/get-exclusion-path.ts';
import { getMainRoot } from '../../shared/exclusion/get-main-root.ts';
import { readExclusions } from '../../shared/exclusion/read-exclusions.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { runGit } from '../../shared/git/run-git.ts';
import { type ExclusionMode, mergeSettings } from './merge-settings.ts';
import { getChangedExclusions, writeExclusions } from './write-exclusions.ts';
import { writeFile } from './write-file.ts';

const SETTINGS_PATH = join('.claude', 'settings.local.json');
const LISTED_FILES_ARGS = ['ls-files', '--cached', '--others', '--exclude-standard', '--'];
const UNDO_COMMANDS: Readonly<Record<ExclusionMode, string>> = {
  exclude: '/ordo:include',
  include: '/ordo:exclude',
};

function main(): void {
  const [projectDir, mode, ...extra] = process.argv.slice(2);
  const home = process.env.HOME;

  const hasProjectDir = projectDir !== undefined && projectDir !== '';
  const hasHome = home !== undefined && home !== '';
  const isMode = mode === 'exclude' || mode === 'include';

  if (!hasProjectDir || !isMode || extra.length > 0 || !hasHome) {
    stop(2, ['usage: ordo/exclusion <project dir> exclude|include, with HOME set']);
  }

  const head = `yapus ordo ${ mode }:`;

  try {
    if (!isDirectory(projectDir)) {
      stop(2, [
        `${ head } ${ projectDir } is not a directory; open the session in the project, nothing written`,
      ]);
    }

    const root = getMainRoot(projectDir, process.env);
    const listPath = getExclusionPath(home);
    const settingsPath = join(root, SETTINGS_PATH);
    const exclusions = readExclusions(listPath);

    if ('violation' in exclusions) {
      stop(2, [`${ head } ${ exclusions.violation }; fix it by hand, nothing written`]);
    }

    const settings = mergeSettings(settingsPath, mode);

    if (settings.kind === 'refused') {
      stop(2, [`${ head } ${ settings.violation }; fix it by hand, nothing written`]);
    }

    const roots = getChangedExclusions(exclusions.roots, root, mode);

    if (settings.kind === 'unchanged' && roots === undefined) {
      const state = mode === 'exclude' ? 'is already excluded' : 'is not excluded';

      stop(0, [`${ head } ${ root } ${ state }; nothing written`]);
    }

    // The settings first, so a list entry never stands without its pattern.
    const written = [
      ...settings.kind === 'changed' ? [writeFile(settingsPath, settings.settingsText)] : [],
      ...roots === undefined ? [] : [writeExclusions(listPath, roots)],
    ];
    const warning = mode === 'exclude' && !isIgnored(root, process.env)
      ? [
        `${ head } git does not ignore ${ settingsPath }; add it to .gitignore or .git/info/exclude before a commit takes it in`,
      ]
      : [];

    stop(0, [
      `${ head } wrote`,
      ...written.map((path) => `  ${ path }`),
      `To undo: ${ UNDO_COMMANDS[mode] }`,
      ...warning,
    ]);
  } catch (error) {
    stop(2, [`${ head } crashed: ${ getFirstLine(error) }`]);
  }
}

function isDirectory(directory: string): boolean {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

// Whether git leaves the settings file out of a commit: it lists the file when
// it is tracked or not ignored, and outside a work tree it lists nothing. Not
// check-ignore, which refuses the literal pathspecs runGit sets.
function isIgnored(root: string, env: NodeJS.ProcessEnv): boolean {
  return runGit([...LISTED_FILES_ARGS, SETTINGS_PATH], root, env).stdout === '';
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(status: 0 | 2, lines: readonly string[]): never {
  writeSync(status === 0 ? process.stdout.fd : process.stderr.fd, `${ lines.join('\n') }\n`);
  process.exit(status);
}

main();
