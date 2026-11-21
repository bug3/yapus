import { isRecord } from '../../../shared/is-record.ts';
import { getBlocks } from '../transcript/get-blocks.ts';
import { readTranscriptLines, type TranscriptLine } from '../transcript/read-transcript-lines.ts';

// What Claude Code answers a call of a tool the agent does not hold with, in
// a tool_result that is an error.
const NOT_HELD_ANSWER = 'No such tool available';

// What the transcript of one agent holds of its work.
export interface TranscriptUsage {
  // The API responses, each counted once.
  readonly turns: number;
  readonly outputTokens: number;
  // Input and cache-write tokens together.
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
  // The earliest and the latest time of a line; undefined when no line has one.
  readonly firstMs: number | undefined;
  readonly lastMs: number | undefined;
  // In the order of their first response.
  readonly models: readonly string[];
  // The calls of the tools the agent held, counted by the tool's name.
  readonly tools: Readonly<Record<string, number>>;
  // The calls of a tool the agent did not hold, counted the same way.
  readonly toolsNotHeld: Readonly<Record<string, number>>;
}

// One API response: an assistant message with an id.
interface Response {
  readonly id: string;
  readonly model: string | undefined;
  readonly outputTokens: number;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
}

// One tool call: a tool_use block with a name.
interface Call {
  // What a tool_result names the call by.
  readonly id: unknown;
  readonly name: string;
}

// The usage over the text of a transcript file; zeros and no times for a
// text that holds no line with a time and no assistant message.
export function getTranscriptUsage(text: string): TranscriptUsage {
  const lines = readTranscriptLines(text);
  const assistantLines = lines.filter((line) => line.type === 'assistant');
  // One API response is written as several lines that repeat id and usage.
  const responses = [
    ...new Map(assistantLines.flatMap(getResponses).map((response) => [response.id, response]))
      .values(),
  ];
  const times = lines.flatMap(getTimes);
  const calls = assistantLines.flatMap(getBlocks).flatMap(getCalls);
  const notHeldIds = new Set<unknown>(lines.flatMap(getBlocks).flatMap(getNotHeldIds));

  return {
    turns: responses.length,
    outputTokens: responses.reduce((total, response) => total + response.outputTokens, 0),
    inputTokens: responses.reduce((total, response) => total + response.inputTokens, 0),
    cacheReadTokens: responses.reduce((total, response) => total + response.cacheReadTokens, 0),
    firstMs: times.reduce<number | undefined>(
      (earliest, time) => getEarlier(earliest, time),
      undefined,
    ),
    lastMs: times.reduce<number | undefined>((latest, time) => getLater(latest, time), undefined),
    models: [...new Set(responses.flatMap(({ model }) => (model === undefined ? [] : [model])))],
    tools: countNames(calls.filter(({ id }) => !notHeldIds.has(id)).map(({ name }) => name)),
    toolsNotHeld: countNames(
      calls.filter(({ id }) => notHeldIds.has(id)).map(({ name }) => name),
    ),
  };
}

function getResponses(line: TranscriptLine): Response[] {
  const { message } = line;

  if (!isRecord(message) || typeof message.id !== 'string') {
    return [];
  }

  const usage = isRecord(message.usage) ? message.usage : {};

  return [{
    id: message.id,
    model: typeof message.model === 'string' ? message.model : undefined,
    outputTokens: getCount(usage.output_tokens),
    inputTokens: getCount(usage.input_tokens) + getCount(usage.cache_creation_input_tokens),
    cacheReadTokens: getCount(usage.cache_read_input_tokens),
  }];
}

function getCount(field: unknown): number {
  return typeof field === 'number' ? field : 0;
}

function getTimes(line: TranscriptLine): number[] {
  const time = typeof line.timestamp === 'string' ? Date.parse(line.timestamp) : Number.NaN;

  return Number.isNaN(time) ? [] : [time];
}

function getEarlier(earliest: number | undefined, time: number): number {
  return earliest === undefined ? time : Math.min(earliest, time);
}

function getLater(latest: number | undefined, time: number): number {
  return latest === undefined ? time : Math.max(latest, time);
}

function getCalls(block: TranscriptLine): Call[] {
  const { type, id, name } = block;

  return type === 'tool_use' && typeof name === 'string' ? [{ id, name }] : [];
}

// The id of the call the block answers, when the block says the agent does
// not hold the tool. Another error and an answer that only quotes the words
// are the answers of a tool the agent holds.
function getNotHeldIds(block: TranscriptLine): string[] {
  const { type, content, is_error: isError, tool_use_id: callId } = block;
  const isNotHeld = type === 'tool_result' && isError === true
    && typeof content === 'string' && content.includes(NOT_HELD_ANSWER);

  return isNotHeld && typeof callId === 'string' ? [callId] : [];
}

function countNames(names: readonly string[]): Record<string, number> {
  return names.reduce<Record<string, number>>(
    (counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }),
    {},
  );
}
