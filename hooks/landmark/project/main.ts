import { writeSync } from 'node:fs';
import { languages } from './language/languages.ts';
import { runProject } from './apply/run-project.ts';

function main(): void {
  const [pluginRoot, projectDir, requested, ...extra] = process.argv.slice(2);

  const hasBoth = pluginRoot !== undefined && pluginRoot !== ''
    && projectDir !== undefined && projectDir !== '';

  const language = languages.find((name) => name === requested);

  const isUnknownLanguage = requested !== undefined && language === undefined;

  if (!hasBoth || extra.length > 0 || isUnknownLanguage) {
    stop(2, ['usage: landmark/project <plugin root> <project dir> [typescript|go]']);
  }

  const request = { env: process.env, requested: language };
  const { status, lines } = runProject(pluginRoot, projectDir, request);

  stop(status, lines);
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(status: 0 | 2, lines: readonly string[]): never {
  writeSync(status === 0 ? process.stdout.fd : process.stderr.fd, `${ lines.join('\n') }\n`);
  process.exit(status);
}

main();
