import type { EndRow, LaunchRow, ReturnRow, Row } from '../record-row.ts';
import { getMedian } from './get-median.ts';

// The counts and medians of one agent type over the record.
export interface AgentStats {
  readonly agent: string;
  // Launch rows: admitted and refused.
  readonly launches: number;
  readonly refused: number;
  // End rows of completed launches, and those that ran out of turns.
  readonly completed: number;
  readonly capped: number;
  // Return rows: all, sent back over the cap, and opening with a word the
  // return contract names.
  readonly returns: number;
  readonly sentBack: number;
  readonly contractWords: number;
  // The verdicts of the returns, each with its count; a second line that
  // opens with another word is not a verdict.
  readonly verdicts: Readonly<Record<string, number>>;
  readonly durationMedianMs: number | undefined;
  readonly tokensMedian: number | undefined;
  readonly toolUsesMedian: number | undefined;
}

// The words contract.md asks every return to open with.
export const CONTRACT_WORDS: readonly string[] = ['DONE', 'PARTIAL', 'QUESTIONS', 'BLOCKED'];

// The words the judges' definitions (critic.md, warden.md) put on the line
// after the status.
export const VERDICT_WORDS: readonly string[] = ['GO', 'REVISE', 'APPROVE', 'REWORK'];

const COMPLETED = 'completed';

// One entry per agent type in the rows, sorted by name.
export function getAgentStats(rows: readonly Row[]): AgentStats[] {
  const agents = [...new Set(rows.map((row) => row.subject))].sort();

  return agents.map((agent) => getStats(agent, rows.filter((row) => row.subject === agent)));
}

function getStats(agent: string, rows: readonly Row[]): AgentStats {
  const launches = rows.filter((row): row is LaunchRow => row.hook === 'launch');
  const ends = rows.filter((row): row is EndRow => row.hook === 'end' && row.status === COMPLETED);
  const returns = rows.filter((row): row is ReturnRow => row.hook === 'return');

  return {
    agent,
    launches: launches.filter((row) => row.allowed).length,
    refused: launches.filter((row) => !row.allowed).length,
    completed: ends.length,
    capped: ends.filter((row) => row.capped).length,
    returns: returns.length,
    sentBack: returns.filter((row) => !row.allowed).length,
    contractWords: returns.filter((row) => CONTRACT_WORDS.includes(row.status)).length,
    verdicts: countWords(returns.map((row) => row.verdict)),
    durationMedianMs: getMedian(ends.map((row) => row.durationMs).filter(isNumber)),
    tokensMedian: getMedian(ends.map((row) => row.tokens).filter(isNumber)),
    toolUsesMedian: getMedian(ends.map((row) => row.toolUses).filter(isNumber)),
  };
}

function countWords(words: readonly (string | undefined)[]): Record<string, number> {
  return words.filter(isVerdictWord).reduce<Record<string, number>>(
    (counts, word) => ({ ...counts, [word]: (counts[word] ?? 0) + 1 }),
    {},
  );
}

function isVerdictWord(word: string | undefined): word is string {
  return word !== undefined && VERDICT_WORDS.includes(word);
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}
