import { isRecord } from '../../../shared/is-record.ts';
import { getBlocks } from '../transcript/get-blocks.ts';
import { readTranscriptLines, type TranscriptLine } from '../transcript/read-transcript-lines.ts';

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
  // The tool calls, counted by the tool's name.
  readonly tools: Readonly<Record<string, number>>;
}

// One API response: an assistant message with an id.
interface Response {
  readonly id: string;
  readonly model: string | undefined;
  readonly outputTokens: number;
  readonly inputTokens: number;
  readonly cacheReadTokens: number;
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
    tools: countTools(assistantLines),
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

function countTools(assistantLines: readonly TranscriptLine[]): Record<string, number> {
  return assistantLines
    .flatMap(getBlocks)
    .flatMap(({ type, name }) => (type === 'tool_use' && typeof name === 'string' ? [name] : []))
    .reduce<Record<string, number>>(
      (counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }),
      {},
    );
}
