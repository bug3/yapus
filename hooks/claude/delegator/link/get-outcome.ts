import { isAbsolute } from 'node:path';
import { findSessionFile } from '../sessions/find-session-file.ts';
import { readMode } from '../settings/read-mode.ts';
import { appendPlanLine } from './append-plan-line.ts';
import { getPlanFile } from './get-plan-file.ts';
import { parseWrite } from './parse-write.ts';

export interface Input {
  readonly stdinText: string;
  // CLAUDE_PLUGIN_DATA, which Claude Code sets for a plugin's hooks.
  readonly dataDir: string | undefined;
  // CLAUDE_PROJECT_DIR, the directory the session was opened in, which holds
  // the plans and the session's file. A subagent's call carries the same one.
  readonly projectRoot: string | undefined;
  readonly time: string;
}

export type Outcome =
  | { readonly kind: 'written' }
  | { readonly kind: 'silence' }
  | { readonly kind: 'failure'; readonly detail: string };

export const NOT_WRITTEN = 'the plan line is not written';

// Appends a plan line to the session's file for the Write or Edit in stdin
// when its file lies in a plan's directory of the project, or says why it
// cannot. Silence: a session switched off, a file that is no plan file, a
// session without a file, since only a logged prompt creates one, and the
// plan and file the last plan line already names.
export function getOutcome(input: Input): Outcome {
  if (input.dataDir === undefined || input.dataDir === '') {
    return makeFailure(`CLAUDE_PLUGIN_DATA is not set; ${ NOT_WRITTEN }; reinstall the plugin`);
  }

  const parsed = parseWrite(input.stdinText);

  if (parsed.kind === 'failure') {
    return makeFailure(`${ parsed.reason }; ${ NOT_WRITTEN }`);
  }

  const { sessionId, filePath } = parsed.write;
  const mode = readMode(input.dataDir, sessionId);

  if (mode.kind === 'value' && mode.value === 'off') {
    return { kind: 'silence' };
  }

  const { projectRoot } = input;

  // A relative root would resolve against the hook's working directory.
  if (projectRoot === undefined || !isAbsolute(projectRoot)) {
    return makeFailure(`CLAUDE_PROJECT_DIR is not an absolute path; ${ NOT_WRITTEN }`);
  }

  const planFile = getPlanFile(projectRoot, filePath);

  if (planFile === undefined) {
    return { kind: 'silence' };
  }

  const found = findSessionFile(projectRoot, sessionId);

  if (found.kind === 'failure') {
    return makeFailure(`${ found.detail }; ${ NOT_WRITTEN }`);
  }

  if (found.kind === 'missing') {
    return { kind: 'silence' };
  }

  const appended = appendPlanLine(found.path, input.time, planFile);

  if (appended.kind === 'failure') {
    return makeFailure(`${ appended.detail }; ${ NOT_WRITTEN }`);
  }

  return { kind: appended.kind === 'written' ? 'written' : 'silence' };
}

function makeFailure(detail: string): Outcome {
  return { kind: 'failure', detail };
}
