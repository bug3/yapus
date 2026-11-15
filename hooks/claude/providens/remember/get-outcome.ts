import {
  appendFileSync,
  existsSync,
  mkdirSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { readMode } from '../settings/read-mode.ts';
import { getPromptsPath } from './get-prompts-path.ts';
import { parsePrompt } from './parse-prompt.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  // CLAUDE_PROJECT_DIR, the directory the session was opened in. The payload's
  // cwd follows every cd, which would split one session's log across folders.
  readonly projectRoot: string | undefined;
  readonly time: string;
}

export type Outcome =
  | { readonly kind: 'written' }
  | { readonly kind: 'silence' }
  | { readonly kind: 'failure'; readonly detail: string };

// A subagent reporting back reaches UserPromptSubmit as a prompt that opens
// with this tag; a typed prompt carries none.
const NOTIFICATION_TAG = '<task-notification>';
const NOT_WRITTEN = 'the prompt is not remembered';
// A prompt can hold a pasted secret: the log stays the person's alone and out
// of git, while .yapus/ beside it keeps the default mode for shared plans.
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const IGNORE_FILE = '.gitignore';
const IGNORE_ALL = '*\n';

// Appends the typed prompt in stdin to the session's prompt log, or says why
// it cannot. A session switched off and a subagent's notification are silence.
export function getOutcome(input: Input): Outcome {
  if (input.dataDir === undefined || input.dataDir === '') {
    return makeFailure(`CLAUDE_PLUGIN_DATA is not set; ${ NOT_WRITTEN }; reinstall the plugin`);
  }

  const parsed = parsePrompt(input.stdinText);

  if (parsed.kind === 'failure') {
    return makeFailure(`${ parsed.reason }; ${ NOT_WRITTEN }`);
  }

  const { sessionId, text } = parsed.prompt;
  const mode = readMode(input.dataDir, sessionId);

  if ((mode.kind === 'value' && mode.value === 'off') || text.startsWith(NOTIFICATION_TAG)) {
    return { kind: 'silence' };
  }

  const { projectRoot } = input;

  if (projectRoot === undefined || !isDirectory(projectRoot)) {
    return makeFailure(`CLAUDE_PROJECT_DIR is not an absolute directory; ${ NOT_WRITTEN }`);
  }

  return append(getPromptsPath(projectRoot, sessionId), { time: input.time, prompt: text });
}

// An existing absolute directory only, so a missing root is never created
// and a relative one never lands beside the hook.
function isDirectory(path: string): boolean {
  return isAbsolute(path) && statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

function append(path: string, line: { readonly time: string; readonly prompt: string }): Outcome {
  const directory = dirname(path);

  try {
    if (!existsSync(directory)) {
      createPromptsDirectory(directory);
    }

    appendFileSync(path, `${ JSON.stringify(line) }\n`, { mode: PRIVATE_FILE_MODE });
  } catch (error) {
    return makeFailure(`cannot write ${ path }: ${ getFirstLine(error) }; ${ NOT_WRITTEN }`);
  }

  return { kind: 'written' };
}

// The ignore file is written only here, so a person who deletes it to commit
// the prompts does not get it back. Without it the directory is removed, so
// the next prompt tries again instead of landing in a directory git sees.
function createPromptsDirectory(directory: string): void {
  mkdirSync(dirname(directory), { recursive: true });
  mkdirSync(directory, { mode: PRIVATE_DIRECTORY_MODE });

  try {
    writeFileSync(join(directory, IGNORE_FILE), IGNORE_ALL);
  } catch (error) {
    rmdirSync(directory);

    throw error;
  }
}

function makeFailure(detail: string): Outcome {
  return { kind: 'failure', detail };
}
