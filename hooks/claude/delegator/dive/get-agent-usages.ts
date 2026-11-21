import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getFirstLine } from '../../../shared/get-first-line.ts';
import { readTranscriptLines, type TranscriptLine } from '../transcript/read-transcript-lines.ts';
import { getTranscriptUsage, type TranscriptUsage } from './get-transcript-usage.ts';

const JOURNAL_FILE = 'journal.jsonl';

// One agent of a workflow run.
export interface AgentUsage extends TranscriptUsage {
  // The label's text before its first colon.
  readonly stage: string;
  // Whether the journal holds a result row of the agent with an answer.
  readonly isReturned: boolean;
}

export type RunRead =
  | { readonly kind: 'usages'; readonly usages: readonly AgentUsage[] }
  | { readonly kind: 'failure'; readonly detail: string };

interface StartedAgent {
  readonly id: string;
  readonly stage: string;
}

// The usage of each agent the journal of a workflow run started, one for an
// agent id, in the journal's order, with zeros and no times for an agent whose
// transcript is not in the directory; a failure when the journal cannot be
// read. Only reads.
export function getAgentUsages(runDirectory: string): RunRead {
  const journalPath = join(runDirectory, JOURNAL_FILE);
  let journal: string;

  try {
    journal = readFileSync(journalPath, 'utf8');
  } catch (error) {
    return { kind: 'failure', detail: `cannot read ${ journalPath }: ${ getFirstLine(error) }` };
  }

  // The journal is JSON lines as a transcript is: a row that does not parse
  // is left out.
  const rows = readTranscriptLines(journal);
  // An agent that is skipped or dies gives its script null, so a result row
  // that holds null is no return.
  const returned = new Set(
    rows.filter((row) => row.type === 'result' && row.result !== null).map((row) => row.agentId),
  );
  // An agent id names one transcript, so its second started row is no second
  // agent: the id keeps its place in the journal and takes the later label.
  const agents = new Map(rows.flatMap(getStartedAgents).map((agent) => [agent.id, agent]));

  return {
    kind: 'usages',
    usages: [...agents.values()].map(({ id, stage }) => ({
      stage,
      isReturned: returned.has(id),
      ...getTranscriptUsage(readTranscript(join(runDirectory, `agent-${ id }.jsonl`))),
    })),
  };
}

// A started row without an agent id names no transcript, so it is no agent;
// one without a label has no stage text.
function getStartedAgents(row: TranscriptLine): StartedAgent[] {
  const { agentId, label } = row;

  if (row.type !== 'started' || typeof agentId !== 'string') {
    return [];
  }

  const [stage = ''] = typeof label === 'string' ? label.split(':') : [];

  return [{ id: agentId, stage }];
}

// No text for a transcript that is missing or cannot be read.
function readTranscript(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
