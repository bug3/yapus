import { writeSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getExclusion } from '../../shared/exclusion/get-exclusion.ts';
import { getFirstLine } from '../../shared/get-first-line.ts';
import { findScopesPath } from './find-scopes-path.ts';
import type { HookInput } from './get-messages.ts';
import { getMessagesWithinLimit } from './get-messages-within-limit.ts';
import { formatMessage } from './output/format-message.ts';

const LIMIT_SECONDS = 5;
const CATALOGS = join(import.meta.dirname, '..', '..', 'shared', 'catalogs');

async function main(): Promise<void> {
  try {
    if (isExcluded()) {
      stop([]);
    }

    stop(await getMessagesWithinLimit(readHookInput(), LIMIT_SECONDS));
  } catch (error) {
    stop([
      formatMessage(`crashed: ${ getFirstLine(error) }; the commit is blocked, fix the hook`),
    ]);
  }
}

// ordo checks nothing in a project on the exclusion list under HOME; git runs
// the hook inside the repository, whose main root the list holds.
function isExcluded(): boolean {
  return getExclusion(process.cwd(), process.env.HOME ?? '', process.env).kind === 'excluded';
}

// git sets GIT_EDITOR to ":" for its commit hooks when no editor opens. The
// catalog paths are relative to the working directory, the repository root
// under git, so that a message names them as the reader sees them.
function readHookInput(): HookInput {
  return {
    messagePath: process.argv[2] ?? '',
    isEditorUsed: process.env.GIT_EDITOR !== ':',
    catalogPaths: {
      types: getCatalogPath('types.json'),
      scopes: getScopesPath(),
      verbs: getCatalogPath('verbs.json'),
    },
  };
}

function getCatalogPath(file: string): string {
  return relative(process.cwd(), join(CATALOGS, file));
}

function getScopesPath(): string | undefined {
  const path = findScopesPath(CATALOGS, process.cwd());

  return path === undefined ? undefined : relative(process.cwd(), path);
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(messages: readonly string[]): never {
  for (const message of messages) {
    writeSync(process.stderr.fd, `${ message }\n`);
  }

  process.exit(messages.length === 0 ? 0 : 2);
}

await main();
