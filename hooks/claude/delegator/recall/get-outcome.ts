import { statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { getPromptsPath } from '../remember/get-prompts-path.ts';
import { readMode } from '../settings/read-mode.ts';
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
// compaction, with the project's plan files, or why it cannot. Another source,
// a session switched off and a session with neither a prompt nor a plan are
// silence.
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

  return recall(getPromptsPath(projectRoot, sessionId), join(projectRoot, '.yapus', 'plans'));
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

function recall(logPath: string, plansDir: string): Outcome {
  const logged = readPrompts(logPath);

  if (logged.kind === 'failure') {
    return makeFailure(`${ logged.detail }; ${ NOT_RECALLED }`);
  }

  const plans = readPlans(plansDir);

  if (plans.kind === 'failure') {
    return makeFailure(`${ plans.detail }; ${ NOT_RECALLED }`);
  }

  const prompts = logged.kind === 'prompts' ? logged.prompts : [];

  if (prompts.length === 0 && plans.paths.length === 0) {
    return { kind: 'silence' };
  }

  const read = readTexts(TEXTS_PATH);

  if (read.kind === 'failure') {
    return makeFailure(`${ read.detail }; ${ NOT_RECALLED }`);
  }

  const additionalContext = formatRecall(read.texts, prompts, { logPath, planPaths: plans.paths });

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
