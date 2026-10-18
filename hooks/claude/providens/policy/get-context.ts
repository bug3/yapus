import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

export const POLICY_PATH = join(import.meta.dirname, 'policy.md');

// Past this many characters Claude Code moves hook text into a file and
// shows the model only a preview.
export const MAX_CHARACTERS = 10000;

export type Context =
  | { readonly kind: 'output'; readonly json: string }
  | { readonly kind: 'failure'; readonly detail: string };

// The SessionStart output that injects the policy file at path, or why it
// cannot; an empty or oversized policy fails, so no session starts without it.
export function getContext(path: string): Context {
  let policy: string;

  try {
    policy = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  if (policy.trim() === '') {
    return { kind: 'failure', detail: `${ path } is empty` };
  }

  if (policy.length > MAX_CHARACTERS) {
    const count = `${ String(policy.length) } characters, over ${ String(MAX_CHARACTERS) }`;

    return { kind: 'failure', detail: `${ path } has ${ count }` };
  }

  return {
    kind: 'output',
    json: JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: policy },
    }),
  };
}
