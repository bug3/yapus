import { appendFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
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
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${ JSON.stringify(line) }\n`);
  } catch (error) {
    return makeFailure(`cannot write ${ path }: ${ getFirstLine(error) }; ${ NOT_WRITTEN }`);
  }

  return { kind: 'written' };
}

function makeFailure(detail: string): Outcome {
  return { kind: 'failure', detail };
}
