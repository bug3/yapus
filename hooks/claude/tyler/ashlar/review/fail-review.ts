import type { HookInput } from '../parse-hook-input.ts';

export interface ReviewContext {
  readonly dataDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly time: string;
}

export type ReviewOutcome =
  | { readonly kind: 'pass' }
  | { readonly kind: 'failure'; readonly detail: string };

// A hook input whose agent id the dispatch has checked.
export type AgentInput = HookInput & { readonly agentId: string };

export const GIT_FIX = 'fix the repository or retry';

// A failed outcome with the detail the person reads.
export function failReview(detail: string): ReviewOutcome {
  return { kind: 'failure', detail };
}
