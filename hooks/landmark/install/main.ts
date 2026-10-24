import { writeSync } from 'node:fs';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { readPlugin } from './read-plugin.ts';
import { writeInstall } from './write-install.ts';

const UNDO = [
  'To undo:',
  '  remove ~/.claude/landmark/',
  '  remove ~/.claude/rules/landmark-*.md',
];

function main(): void {
  const [root] = process.argv.slice(2);
  const home = process.env.HOME;

  const hasHome = home !== undefined && home !== '';

  if (root === undefined || !hasHome) {
    stop(2, ['usage: landmark/install <plugin root>, with HOME set']);
  }

  try {
    const written = writeInstall(home, readPlugin(root));

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
