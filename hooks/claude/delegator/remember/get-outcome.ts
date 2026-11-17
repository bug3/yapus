import { appendFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { findSessionFile } from '../sessions/find-session-file.ts';
import { getSessionPath } from '../sessions/get-session-path.ts';
import { prepareMonthDirectory } from '../sessions/prepare-month-directory.ts';
import { readMode } from '../settings/read-mode.ts';
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
// A prompt can hold a pasted secret: the log stays the person's alone.
const PRIVATE_FILE_MODE = 0o600;

// Appends the typed prompt in stdin to the session's prompt log, or says why
// it cannot. A session switched off and a subagent's notification are silence.
// The session's first logged prompt names the file by its time, and every
// later prompt goes to that file, whatever the month has become.
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

  const found = findSessionFile(projectRoot, sessionId);

  if (found.kind === 'failure') {
    return makeFailure(`${ found.detail }; ${ NOT_WRITTEN }`);
  }

  const path = found.kind === 'file'
    ? found.path
    : getSessionPath(projectRoot, sessionId, input.time);

  return append(projectRoot, path, { time: input.time, prompt: text });
}

// An existing absolute directory only, so a missing root is never created
// and a relative one never lands beside the hook.
function isDirectory(path: string): boolean {
  return isAbsolute(path) && statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

// The month is the one in the path, so a file found in an earlier month gets
// its ignore file back without a directory for the present month.
function append(
  projectRoot: string,
  path: string,
  line: { readonly time: string; readonly prompt: string },
): Outcome {
  try {
    prepareMonthDirectory(projectRoot, basename(dirname(path)));
    appendFileSync(path, `${ JSON.stringify(line) }\n`, { mode: PRIVATE_FILE_MODE });
  } catch (error) {
    return makeFailure(`cannot write ${ path }: ${ getFirstLine(error) }; ${ NOT_WRITTEN }`);
  }

  return { kind: 'written' };
}

function makeFailure(detail: string): Outcome {
  return { kind: 'failure', detail };
}
