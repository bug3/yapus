import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';

export const CONTRACT_PATH = join(import.meta.dirname, 'contract.md');

// The most characters a subagent's return may carry into the session,
// stated to every subagent through the contract: 3000 tokens at four
// characters a token.
export const RETURN_CAP_CHARACTERS = 12000;

export const CAP_PLACEHOLDER = '{return-cap}';

export type Context =
  | { readonly kind: 'output'; readonly json: string }
  | { readonly kind: 'failure'; readonly detail: string };

// The SubagentStart output that gives a subagent the return contract at
// path, with the return cap filled in, or why it cannot.
export function getContext(path: string): Context {
  let contract: string;

  try {
    contract = readFileSync(path, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ path }: ${ getFirstLine(error) }` };
  }

  if (contract.split(CAP_PLACEHOLDER).length !== 2) {
    return { kind: 'failure', detail: `${ path } does not hold ${ CAP_PLACEHOLDER } once` };
  }

  const additionalContext = contract.replace(CAP_PLACEHOLDER, String(RETURN_CAP_CHARACTERS));
  const hookSpecificOutput = { hookEventName: 'SubagentStart', additionalContext };

  return { kind: 'output', json: JSON.stringify({ hookSpecificOutput }) };
}
