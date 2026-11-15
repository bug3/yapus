import { join } from 'node:path';

// The prompt log of a session: one JSON line per typed prompt, under the
// directory the session was opened in, apart from the plans beside it.
export function getPromptsPath(projectRoot: string, sessionId: string): string {
  return join(projectRoot, '.yapus', 'prompts', `${ sessionId }.jsonl`);
}
