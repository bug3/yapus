import type { ReturnWords } from '../contract/read-return-words.ts';
import type { EndRow, LaunchRow, ResumeRow, ReturnRow, Row } from '../record-row.ts';
import { getCompletions, getSilentEnds } from './get-completions.ts';
import { getMedian } from './get-median.ts';

// The counts and medians of one agent type over the record.
export interface AgentStats {
  readonly agent: string;
  // Launch rows: admitted and refused.
  readonly launches: number;
  readonly refused: number;
  // Completions (a return row or a completed end row), and those that ran out
  // of turns.
  readonly completed: number;
  readonly capped: number;
  // End rows of launches that neither completed nor returned: a cap or a kill in the background.
  readonly noReturn: number;
  // Return rows other than waiting stops: all, sent back over the cap, and
  // opening with a word the return contract names.
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

// One entry per agent type in the rows, sorted by name.
export function getAgentStats(rows: readonly Row[], words: ReturnWords): AgentStats[] {
  const named = rows.filter(hasSubject);
  const agents = [...new Set(named.map((row) => row.subject))].sort();
  const subjects = getSubjects(named);
  const waitingStops = getWaitingStops(rows);

  return agents.map((agent) => getStats(
    agent,
    rows.filter((row) => getSubject(row, subjects) === agent),
    { waitingStops, words },
  ));
}

// The agent type of each agent id that has an end or a return row.
function getSubjects(rows: readonly Exclude<Row, ResumeRow>[]): ReadonlyMap<string, string> {
  return new Map(rows.flatMap((row): [string, string][] =>
    (row.hook === 'end' || row.hook === 'return') && row.agentId !== undefined
      ? [[row.agentId, row.subject]]
      : []));
}

// A resume row names no agent type: it counts under the type of its launch,
// found through the agent id, and under none when the id has no end or return.
function getSubject(row: Row, subjects: ReadonlyMap<string, string>): string | undefined {
  return row.hook === 'resume' ? subjects.get(row.agentId) : row.subject;
}

function hasSubject(row: Row): row is Exclude<Row, ResumeRow> {
  return row.hook !== 'resume';
}

// What the stats of every agent type read beside its own rows: the waiting
// stops of the whole record and the return words.
interface Reading {
  readonly waitingStops: ReadonlySet<ReturnRow>;
  readonly words: ReturnWords;
}

function getStats(
  agent: string,
  rows: readonly Row[],
  { waitingStops, words }: Reading,
): AgentStats {
  const launches = rows.filter((row): row is LaunchRow => row.hook === 'launch');
  const completions = getCompletions(rows);
  const returns = rows.filter((row): row is ReturnRow =>
    row.hook === 'return' && !waitingStops.has(row));

  return {
    agent,
    launches: launches.filter((row) => row.allowed).length,
    refused: launches.filter((row) => !row.allowed).length,
    completed: completions.length,
    capped: completions.filter((entry) => entry.capped).length,
    noReturn: getSilentEnds(rows).length,
    returns: returns.length,
    sentBack: returns.filter((row) => !row.allowed).length,
    contractWords: returns.filter((row) => words.statuses.includes(row.status)).length,
    verdicts: countVerdicts(returns.map((row) => row.verdict), words.verdicts),
    durationMedianMs: getMedian(completions.map((entry) => entry.durationMs).filter(isNumber)),
    tokensMedian: getMedian(completions.map((entry) => entry.tokens).filter(isNumber)),
    toolUsesMedian: getMedian(completions.map((entry) => entry.toolUses).filter(isNumber)),
  };
}

// The return rows a subagent left when it only stopped to wait for a subagent
// it launched in the background: at the time of the return, the subagent
// had a nested launch whose subagent had not yet returned. A nested launch
// reaches its subagent through the end row that shares its call id; one
// without that end row makes no return a waiting stop.
function getWaitingStops(rows: readonly Row[]): ReadonlySet<ReturnRow> {
  const returns = rows.filter((row): row is ReturnRow => row.hook === 'return');
  const nested = rows.flatMap((row) => getNestedLaunch(rows, row) ?? []);

  return new Set(returns.filter((stop) => nested.some((launch) =>
    launch.callerId === stop.agentId
    && launch.time <= stop.time
    && !returns.some((done) => done.agentId === launch.agentId && done.time <= stop.time))));
}

interface NestedLaunch {
  readonly callerId: string;
  readonly agentId: string;
  readonly time: string;
}

function getNestedLaunch(rows: readonly Row[], launch: Row): NestedLaunch | undefined {
  if (launch.hook !== 'launch' || launch.callerId === undefined
    || launch.toolUseId === undefined) {
    return undefined;
  }

  const end = rows.find((row): row is EndRow =>
    row.hook === 'end' && row.toolUseId === launch.toolUseId);

  return end === undefined
    ? undefined
    : { callerId: launch.callerId, agentId: end.agentId, time: launch.time };
}

function countVerdicts(
  words: readonly (string | undefined)[],
  verdicts: readonly string[],
): Record<string, number> {
  return words.filter((word): word is string => word !== undefined && verdicts.includes(word))
    .reduce<Record<string, number>>(
      (counts, word) => ({ ...counts, [word]: (counts[word] ?? 0) + 1 }),
      {},
    );
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}
