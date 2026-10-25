import { writeSync } from 'node:fs';
import { runProject } from './apply/run-project.ts';

function main(): void {
  const [pluginRoot, projectDir, ...extra] = process.argv.slice(2);

  const hasBoth = pluginRoot !== undefined && pluginRoot !== ''
    && projectDir !== undefined && projectDir !== '';

  if (!hasBoth || extra.length > 0) {
    stop(2, ['usage: landmark/project <plugin root> <project dir>']);
  }

  const request = { env: process.env, requested: undefined };
  const { status, lines } = runProject(pluginRoot, projectDir, request);

  stop(status, lines);
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(status: 0 | 2, lines: readonly string[]): never {
  writeSync(status === 0 ? process.stdout.fd : process.stderr.fd, `${ lines.join('\n') }\n`);
  process.exit(status);
}

main();
