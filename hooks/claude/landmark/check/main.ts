import { spawnSync } from 'node:child_process';
import { readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { formatMessage } from '../../../shared/format-message.ts';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { isRecord } from '../../../shared/is-record.ts';
import { getLine } from './get-line.ts';

const PROGRAM = 'landmark check';

const GIT_TIMEOUT_MS = 5000;
const UNSET_STATUS = 1;

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

function readPluginVersion(root: string): string {
  const manifestPath = join(root, '.claude-plugin', 'plugin.json');
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!isRecord(manifest) || typeof manifest.version !== 'string') {
    throw new Error('plugin.json has no version string');
  }

  return manifest.version;
}

function readStamp(home: string): string | undefined {
  try {
    return readFileSync(join(home, '.claude', 'landmark', 'version'), 'utf8').trim();
  } catch {
    return undefined;
  }
}

function readGlobalHooksPath(): string | undefined {
  const readRun = spawnSync(
    'git',
    ['config', '--global', '--type=path', '--get', 'core.hooksPath'],
    { encoding: 'utf8', timeout: GIT_TIMEOUT_MS },
  );

  if (readRun.status === UNSET_STATUS) {
    return undefined;
  }

  if (readRun.status !== 0) {
    throw new Error(`git config could not read core.hooksPath: ${ readRun.stderr.trim() }`);
  }

  return readRun.stdout.trimEnd();
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
