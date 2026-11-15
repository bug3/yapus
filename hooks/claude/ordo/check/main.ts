import { readFileSync, writeSync } from 'node:fs';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { getStampPath } from '../../../shared/hooks-path/get-stamp-path.ts';
import { readGlobalHooksPath } from '../../../shared/hooks-path/read-global-hooks-path.ts';
import { readPluginVersion } from '../../../shared/read-plugin-version.ts';
import { getLine } from './get-line.ts';

const PROGRAM = 'ordo check';

// A state to report is a line on stdout and exit 0; a crash is a line on stderr
// and exit 2, which at SessionStart shows the person the error and blocks nothing.
function main(): void {
  try {
    const root = process.argv[2] ?? '';
    const home = process.env.HOME ?? '';
    const line = getLine({
      pluginVersion: readPluginVersion(root),
      stamp: readStamp(home),
      home,
      globalHooksPath: readGlobalHooksPath(),
      env: process.env,
    });

    stop(line);
  } catch (error) {
    fail(`crashed: ${ getFirstLine(error) }; fix the hook`);
  }
}

function readStamp(home: string): string | undefined {
  try {
    return readFileSync(getStampPath(home), 'utf8').trim();
  } catch {
    return undefined;
  }
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(line: string | undefined): never {
  if (line !== undefined) {
    const output = {
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: line },
    };

    writeSync(process.stdout.fd, `${ JSON.stringify(output) }\n`);
  }

  process.exit(0);
}

function fail(detail: string): never {
  writeSync(process.stderr.fd, `${ formatMessage(PROGRAM, detail) }\n`);
  process.exit(2);
}

main();
