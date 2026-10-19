import type { Place } from '../../../../../../hooks/claude/tyler/ashlar/git/run-git.ts';
import type {
  AgentInput,
  ReviewContext,
} from '../../../../../../hooks/claude/tyler/ashlar/review/fail-review.ts';
import { getGitEnv } from '../../../../../helpers/run-git.ts';

const TIME = '2026-10-19T10:00:00Z';

function makeInput(cwd: string, event: string, extra: Partial<AgentInput> = {}): AgentInput {
  return { sessionId: 's1', cwd, event, agentId: 'agent-1', isRetry: false, ...extra };
}

function makeContext(dataDir: string): ReviewContext {
  return { dataDir, env: getGitEnv(process.env), time: TIME };
}

function makePlace(cwd: string): Place {
  return { cwd, env: getGitEnv(process.env) };
}

// The shared setup of the review tests: a hook input, its context and a git
// place, all isolated from the machine's git config.
export const reviewFixture = { makeInput, makeContext, makePlace };
