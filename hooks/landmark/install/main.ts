import { writeSync } from 'node:fs';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getHooksPath } from '../../shared/hooks-path/get-hooks-path.ts';
import { getConflicts } from './get-conflicts.ts';
import { readGlobalHooksPath } from './hooks-path/read-global-hooks-path.ts';
import { readPlugin } from './read-plugin.ts';
import { writeGlobalHooksPath } from './hooks-path/write-global-hooks-path.ts';
import { writeHooks } from './write-hooks.ts';
import { writeInstall } from './write-install.ts';

const UNDO = [
  'To undo:',
  '  git config --global --unset core.hooksPath',
  '  remove ~/.claude/landmark/',
  '  remove ~/.claude/rules/landmark-*.md',
];

function main(): void {
  const [root, mode, ...extra] = process.argv.slice(2);
  const home = process.env.HOME;

  const hasHome = home !== undefined && home !== '';
  const isMode = mode === 'install' || mode === 'upgrade';

  if (root === undefined || !isMode || extra.length > 0 || !hasHome) {
    stop(2, ['usage: landmark/install <plugin root> install|upgrade, with HOME set']);
  }

  try {
    const hooksPath = readGlobalHooksPath();
    const conflicts = getConflicts(mode, { home, env: process.env, globalHooksPath: hooksPath });

    if (conflicts.length > 0) {
      stop(2, [`yapus landmark ${ mode }: refused, nothing written`, ...conflicts]);
    }

    const written = [...writeInstall(home, readPlugin(root)), ...writeHooks(home, root)];

    if (hooksPath === undefined) {
      writeGlobalHooksPath(getHooksPath(home));
    }

    stop(0, [`yapus landmark ${ mode }: wrote`, ...written, ...UNDO]);
  } catch (error) {
    stop(2, [`yapus landmark ${ mode }: crashed: ${ getFirstLine(error) }`]);
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(status: 0 | 2, lines: readonly string[]): never {
  writeSync(status === 0 ? process.stdout.fd : process.stderr.fd, `${ lines.join('\n') }\n`);
  process.exit(status);
}

main();
