import { readFileSync } from 'node:fs';
import { isRecord } from '../../../shared/is-record.ts';

export interface TranscriptStats {
  readonly turns: number;
  readonly toolUses: number;
  readonly tokens: number;
  readonly durationMs: number;
  readonly model: string | undefined;
}

type Line = Readonly<Record<string, unknown>>;

interface Message {
  readonly id: string;
  readonly model: unknown;
  readonly usage: unknown;
}

const USAGE_FIELDS = [
  'input_tokens',
  'output_tokens',
  'cache_creation_input_tokens',
  'cache_read_input_tokens',
] as const;

// The stats of the transcript file at path; undefined when there is no path,
// the file cannot be read or it holds no assistant message.
export function readTranscriptStats(path: string | undefined): TranscriptStats | undefined {
  if (path === undefined) {
    return undefined;
  }

  let text: string;

  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }

  return getTranscriptStats(text);
}

// Totals over the text of a transcript file; undefined when it holds no
// assistant message with an id.
export function getTranscriptStats(text: string): TranscriptStats | undefined {
  const lines = text.split('\n').map(parseLine).filter((line) => line !== undefined);
  const messages = lines.map(getMessage).filter((message) => message !== undefined);
  // One API response is written as several lines that repeat id and usage.
  const distinct = new Map(messages.map((message) => [message.id, message]));
  const last = [...distinct.values()].at(-1);

  if (last === undefined) {
    return undefined;
  }

  return {
    turns: distinct.size,
    toolUses: lines.reduce((total, line) => total + countToolUses(line), 0),
    tokens: sumUsage(last.usage),
    durationMs: getDurationMs(lines),
    model: typeof last.model === 'string' ? last.model : undefined,
  };
}

function parseLine(text: string): Line | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getMessage(line: Line): Message | undefined {
  const { message } = line;

  if (line.type !== 'assistant' || !isRecord(message) || typeof message.id !== 'string') {
    return undefined;
  }

  return { id: message.id, model: message.model, usage: message.usage };
}

function countToolUses(line: Line): number {
  const { message } = line;

  if (line.type !== 'assistant' || !isRecord(message) || !Array.isArray(message.content)) {
    return 0;
  }

  return message.content.filter((block) => isRecord(block) && block.type === 'tool_use')
    .length;
}

function sumUsage(usage: unknown): number {
  if (!isRecord(usage)) {
    return 0;
  }

  return USAGE_FIELDS.reduce((total, field) => {
    const count = usage[field];

    return total + (typeof count === 'number' ? count : 0);
  }, 0);
}

function getDurationMs(lines: readonly Line[]): number {
  const times = lines
    .map((line) => line.timestamp)
    .filter((stamp) => typeof stamp === 'string')
    .map((stamp) => Date.parse(stamp))
    .filter((time) => !Number.isNaN(time));
  const [first] = times;
  const last = times.at(-1);

  return first === undefined || last === undefined ? 0 : last - first;
}
