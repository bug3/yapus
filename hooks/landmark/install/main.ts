import { writeSync } from 'node:fs';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { getConflicts } from './get-conflicts.ts';
import { readPlugin } from './read-plugin.ts';
import { writeHooks } from './write-hooks.ts';
import { writeInstall } from './write-install.ts';

const UNDO = [
  'To undo:',
  '  remove ~/.claude/landmark/',
  '  remove ~/.claude/rules/landmark-*.md',
];

function main(): void {
  const [root, mode, ...extra] = process.argv.slice(2);
  const home = process.env.HOME;

  const hasHome = home !== undefined && home !== '';

  if (root === undefined || mode !== 'install' || extra.length > 0 || !hasHome) {
    stop(2, ['usage: landmark/install <plugin root> install, with HOME set']);
  }

  try {
    const conflicts = getConflicts(home);

    if (conflicts.length > 0) {
      stop(2, ['yapus landmark install: refused, nothing written', ...conflicts]);
    }

    const written = [...writeInstall(home, readPlugin(root)), ...writeHooks(home, root)];

    stop(0, ['yapus landmark install: wrote', ...written, ...UNDO]);
  } catch (error) {
    stop(2, [`yapus landmark install: crashed: ${ getFirstLine(error) }`]);
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(status: 0 | 2, lines: readonly string[]): never {
  writeSync(status === 0 ? process.stdout.fd : process.stderr.fd, `${ lines.join('\n') }\n`);
  process.exit(status);
}

main();
