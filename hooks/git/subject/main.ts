import { writeSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getFirstLine } from '../../shared/get-first-line.ts';
import type { HookInput } from './get-messages.ts';
import { getMessagesWithinLimit } from './get-messages-within-limit.ts';
import { formatMessage } from './output/format-message.ts';

const LIMIT_SECONDS = 5;

async function main(): Promise<void> {
  try {
    stop(await getMessagesWithinLimit(readHookInput(), LIMIT_SECONDS));
  } catch (error) {
    stop([
      formatMessage(`crashed: ${ getFirstLine(error) }; the commit is blocked, fix the hook`),
    ]);
  }
}

// git sets GIT_EDITOR to ":" for its commit hooks when no editor opens. The
// catalog paths are relative to the working directory, the repository root
// under git, so that a message names them as the reader sees them.
function readHookInput(): HookInput {
  return {
    messagePath: process.argv[2] ?? '',
    isEditorUsed: process.env.GIT_EDITOR !== ':',
    catalogPaths: {
      types: getCatalogPath(import.meta.dirname, '..', '..', 'shared', 'catalogs', 'types.json'),
      scopes: getCatalogPath(import.meta.dirname, 'catalogs', 'scopes.json'),
      verbs: getCatalogPath(import.meta.dirname, 'catalogs', 'verbs.json'),
    },
  };
}

function getCatalogPath(...parts: readonly string[]): string {
  return relative(process.cwd(), join(...parts));
}

// writeSync, because process.exit can drop a pending write to a pipe.
function stop(messages: readonly string[]): never {
  for (const message of messages) {
    writeSync(process.stderr.fd, `${ message }\n`);
  }

  process.exit(messages.length === 0 ? 0 : 2);
}

await main();
