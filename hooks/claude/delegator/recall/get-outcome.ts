import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { getPlansDirectory } from '../plans/get-plans-directory.ts';
import { findSessionFile } from '../sessions/find-session-file.ts';
import { readMode } from '../settings/read-mode.ts';
import { findMoves } from '../upgrade/find-moves.ts';
import { BUDGET_CHARACTERS, formatRecall } from './format-recall.ts';
import { parseStart } from './parse-start.ts';
import { readPlans } from './read-plans.ts';
import { readPrompts } from './read-prompts.ts';
import { readTexts, TEXTS_PATH } from './read-texts.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  // CLAUDE_PROJECT_DIR, the directory the session was opened in, where
  // remember keeps the prompt log.
  readonly projectRoot: string | undefined;
}

export type Outcome =
  | { readonly kind: 'output'; readonly json: string }
  | { readonly kind: 'silence' }
  | { readonly kind: 'failure'; readonly detail: string };

// A compaction drops the person's earlier prompts from the context; no other
// start does.
const COMPACT = 'compact';
const NOT_RECALLED = 'the prompts are not recalled';

// The SessionStart output that gives the session's typed prompts back after a
// compaction, with the project's plan files and the notice of an older
// layout, or why it cannot. Another source, a session switched off and a
// session with no prompt, no plan and no older layout are silence.
export function getOutcome(input: Input): Outcome {
  const parsed = parseStart(input.stdinText);

  if (parsed.kind === 'failure') {
    return makeFailure(`${ parsed.reason }; ${ NOT_RECALLED }`);
  }

  const { sessionId, source } = parsed.start;

  if (source !== COMPACT || isOff(input.dataDir, sessionId)) {
    return { kind: 'silence' };
  }

  const { projectRoot } = input;

  if (projectRoot === undefined || !isDirectory(projectRoot)) {
    return makeFailure(`CLAUDE_PROJECT_DIR is not an absolute directory; ${ NOT_RECALLED }`);
  }

  const found = findSessionFile(projectRoot, sessionId);

  if (found.kind === 'failure') {
    return makeFailure(`${ found.detail }; ${ NOT_RECALLED }`);
  }

  const logPath = found.kind === 'file' ? found.path : undefined;

  return recall(projectRoot, logPath);
}

// Anything the hook cannot read is not off, as for the policy.
function isOff(dataDir: string | undefined, sessionId: string): boolean {
  if (dataDir === undefined || dataDir === '') {
    return false;
  }

  const mode = readMode(dataDir, sessionId);

  return mode.kind === 'value' && mode.value === 'off';
}

// An existing absolute directory only, so a relative root never resolves
// against the hook's working directory.
function isDirectory(path: string): boolean {
  return isAbsolute(path) && statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

// A session with no file for its id has no logged prompt.
function recall(projectRoot: string, logPath: string | undefined): Outcome {
  const logged = logPath === undefined ? { kind: 'missing' } as const : readPrompts(logPath);

  if (logged.kind === 'failure') {
    return makeFailure(`${ logged.detail }; ${ NOT_RECALLED }`);
  }

  const plans = readPlans(getPlansDirectory(projectRoot));

  if (plans.kind === 'failure') {
    return makeFailure(`${ plans.detail }; ${ NOT_RECALLED }`);
  }

  const prompts = logged.kind === 'prompts' ? logged.prompts : [];
  // The layout is older while the upgrade has a move to make; a file it would
  // leave needs the person's hand, and the upgrade's last run named it.
  const hasOlderLayout = findMoves(projectRoot).moves.length > 0;

  if (prompts.length === 0 && plans.paths.length === 0 && !hasOlderLayout) {
    return { kind: 'silence' };
  }

  const read = readTexts(TEXTS_PATH);

  if (read.kind === 'failure') {
    return makeFailure(`${ read.detail }; ${ NOT_RECALLED }`);
  }

  // The path is written only beside a prompt, and a prompt comes from a file.
  const paths = { logPath: logPath ?? '', planPaths: plans.paths, hasOlderLayout };
  const additionalContext = formatRecall(read.texts, prompts, paths);

  if (additionalContext === undefined) {
    const over = `the fixed lines of the recall pass ${ String(BUDGET_CHARACTERS) } characters`;

    return makeFailure(`${ over }; ${ NOT_RECALLED }`);
  }

  const hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext };

  return { kind: 'output', json: JSON.stringify({ hookSpecificOutput }) };
}

function makeFailure(detail: string): Outcome {
  return { kind: 'failure', detail };
}
