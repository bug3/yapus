import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import {
  type EndRow,
  type LaunchRow,
  RECORD_FILE,
  type ResumeRow,
  type ReturnRow,
  type Row,
} from '../record-row.ts';
import { CONTRACT_WORDS } from '../report/get-agent-stats.ts';
import { readRows } from '../report/read-rows.ts';
import { getBlocks } from '../transcript/get-blocks.ts';
import { readTranscriptLines, type TranscriptLine } from '../transcript/read-transcript-lines.ts';

// How much of a transcript's end is read: a call that waits is at the end,
// and a transcript grows to megabytes.
const TAIL_BYTES = 65536;
// The status the Agent tool reports for a background launch.
const BACKGROUND = 'async_launched';
const MS_PER_MINUTE = 60000;

// A tool call of a transcript: its id, the tool and the time of its line.
interface Call {
  readonly id: string;
  readonly name: string;
  readonly time: number;
}

// One line for each background launch of the session that is still running:
// the tool call its subagent waits on with the whole minutes it has waited,
// or that its transcript cannot be read; no line for a subagent whose every
// call has its result. Only reads; a missing record gives no line.
export function getWaits(dataDir: string, sessionId: string, now: Date): string {
  const rows = readRecord(dataDir).filter((row) => row.sessionId === sessionId);

  return rows
    .filter((row): row is EndRow => row.hook === 'end' && row.status === BACKGROUND)
    .filter((end) => isRunning(end, rows))
    .map((end) => getLine(end.outputFile, getDescription(end, rows), now))
    .join('');
}

function readRecord(dataDir: string): readonly Row[] {
  let text: string;

  try {
    text = readFileSync(join(dataDir, RECORD_FILE), 'utf8');
  } catch {
    return [];
  }

  return readRows(text).rows;
}

// A launch runs until the newest of its agent's return and resume rows is a
// return the gate let through that opens with a word of the contract: a stop
// in the middle of the work opens with another word, and a resume starts the
// agent again.
function isRunning(end: EndRow, rows: readonly Row[]): boolean {
  const newest = rows.findLast((row): row is ReturnRow | ResumeRow =>
    (row.hook === 'return' || row.hook === 'resume') && row.agentId === end.agentId);

  return newest?.hook !== 'return' || !newest.allowed || !CONTRACT_WORDS.includes(newest.status);
}

// The launch row shares the call id of its end row; without one the agent
// type stands in for the description.
function getDescription(end: EndRow, rows: readonly Row[]): string {
  const launch = rows.find((row): row is LaunchRow =>
    row.hook === 'launch' && row.toolUseId !== undefined && row.toolUseId === end.toolUseId);

  return launch?.description ?? end.subject;
}

// The line of one launch, or no text when every call read has its result.
function getLine(outputFile: string | undefined, description: string, now: Date): string {
  // A read that starts inside the file starts inside a line, and the subagent
  // may be appending to its transcript, so the first line and the last may be
  // cut: neither parses, and both are left out.
  const transcript = readTranscriptLines(outputFile === undefined ? '' : readTail(outputFile));

  if (transcript.length === 0) {
    return `no transcript to read: ${ description }\n`;
  }

  const call = getOldestOpenCall(transcript);

  if (call === undefined) {
    return '';
  }

  const minutes = Math.floor((now.getTime() - call.time) / MS_PER_MINUTE);

  return `waiting on ${ call.name } for ${ String(minutes) } min: ${ description }\n`;
}

// The last TAIL_BYTES of the file, the whole file when it is shorter, and no
// text when it cannot be opened or read.
function readTail(path: string): string {
  let descriptor: number;

  try {
    descriptor = openSync(path, 'r');
  } catch {
    return '';
  }

  try {
    const { size } = fstatSync(descriptor);
    const tail = Buffer.alloc(Math.min(size, TAIL_BYTES));
    const length = readSync(descriptor, tail, 0, tail.length, size - tail.length);

    return tail.toString('utf8', 0, length);
  } catch {
    return '';
  } finally {
    closeSync(descriptor);
  }
}

// A line holds a call as a tool_use block, and a later line answers it with a
// tool_result block that names the call's id.
function getOldestOpenCall(transcript: readonly TranscriptLine[]): Call | undefined {
  const answered = new Set(transcript.flatMap(getBlocks).map((block) => block.tool_use_id));

  return transcript
    .flatMap(getCalls)
    .filter((call) => !answered.has(call.id))
    .reduce<Call | undefined>(
      (oldest, call) => (oldest === undefined || call.time < oldest.time ? call : oldest),
      undefined,
    );
}

// A call without an id, a tool name or a time on its line cannot be matched
// or aged, so it is no call; the copy a transcript keeps of an API request
// holds its calls on a line without a time.
function getCalls(line: TranscriptLine): Call[] {
  const time = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : Number.NaN;

  return getBlocks(line).flatMap((block) => {
    const { id, name } = block;

    return block.type === 'tool_use' && typeof id === 'string' && typeof name === 'string'
      && !Number.isNaN(time)
      ? [{ id, name, time }]
      : [];
  });
}
