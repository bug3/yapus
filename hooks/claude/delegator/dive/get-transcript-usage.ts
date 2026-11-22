import { isRecord } from '../../../shared/is-record.ts';
import { getBlocks } from '../transcript/get-blocks.ts';
import { readTranscriptLines, type TranscriptLine } from '../transcript/read-transcript-lines.ts';

// What Claude Code answers a call of a tool the workflow agent does not hold
// with, in a tool_result that is an error: these words, then the name of the
// tool.
const NOT_HELD_ANSWER = 'No such tool available: ';
// What WebFetch answers a fetch that brought no page with, in a tool_result
// that is no error: these words, then the status or the place the URL
// redirects to.
const HTTP_STATUS_ANSWER = 'The server returned HTTP ';
const REDIRECT_ANSWER = 'REDIRECT DETECTED: ';
const WEB_FETCH = 'WebFetch';
// The authority of a URL: the text after :// up to the first /, ? or #.
const AUTHORITY_PATTERN = /:\/\/([^/?#]+)/u;
const NO_FETCHES: HostFetches = { fetches: 0, failed: 0 };

// The WebFetch calls to one host.
export interface HostFetches {
  readonly fetches: number;
  // The calls answered with an error or with no page.
  readonly failed: number;
}

// What the transcript of one workflow agent holds of its work.
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
  // The calls of the tools the workflow agent held, counted by the tool's name.
  readonly tools: Readonly<Record<string, number>>;
  // The calls of a tool the workflow agent did not hold, counted the same way.
  readonly toolsNotHeld: Readonly<Record<string, number>>;
  // The WebFetch calls by the lowercased host of their URL, each call id
  // once; a call without a URL is left out.
  readonly fetches: Readonly<Record<string, HostFetches>>;
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

// One WebFetch call: a tool_use block with an id and the host of its URL.
interface Fetch {
  readonly id: string;
  readonly host: string;
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
  const errors = new Map<unknown, string>(lines.flatMap(getBlocks).flatMap(getErrors));
  // A call written on two lines is one call.
  const fetches = new Map(
    assistantLines.flatMap(getBlocks).flatMap(getFetches).map(({ id, host }) => [id, host]),
  );
  const failedIds = new Set(lines.flatMap(getBlocks).flatMap(getFailedIds));

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
    tools: countNames(
      calls.filter((call) => !isNotHeld(call, errors)).map(({ name }) => name),
    ),
    toolsNotHeld: countNames(
      calls.filter((call) => isNotHeld(call, errors)).map(({ name }) => name),
    ),
    fetches: countFetches(fetches, failedIds),
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

// The id of the call the block answers and the text of the answer, when the
// block is an answer that is an error.
function getErrors(block: TranscriptLine): [string, string][] {
  const { type, content, is_error: isError, tool_use_id: callId } = block;

  return type === 'tool_result' && isError === true
    && typeof callId === 'string' && typeof content === 'string'
    ? [[callId, content]]
    : [];
}

// Whether the error that answers the call says the workflow agent does not
// hold the tool of that call. An error that quotes the words for another tool
// is the output of a tool the workflow agent holds, such as a command that
// printed them.
function isNotHeld({ id, name }: Call, errors: ReadonlyMap<unknown, string>): boolean {
  return errors.get(id)?.includes(`${ NOT_HELD_ANSWER }${ name }`) === true;
}

function getFetches(block: TranscriptLine): Fetch[] {
  const { type, id, name, input } = block;

  if (type !== 'tool_use' || name !== WEB_FETCH || typeof id !== 'string' || !isRecord(input)
    || typeof input.url !== 'string') {
    return [];
  }

  const authority = AUTHORITY_PATTERN.exec(input.url)?.[1] ?? '';
  // The host: the whole authority when it holds @, else the authority up to
  // the first :.
  const host = authority.includes('@') ? authority : authority.split(':')[0] ?? '';

  return host === '' ? [] : [{ id, host: host.toLowerCase() }];
}

// The id of the call the block answers, when the block is an answer that is
// an error or that brought no page.
function getFailedIds(block: TranscriptLine): string[] {
  const { type, content, is_error: isError, tool_use_id: callId } = block;
  const isNoPage = typeof content === 'string'
    && (content.startsWith(HTTP_STATUS_ANSWER) || content.startsWith(REDIRECT_ANSWER));

  return type === 'tool_result' && typeof callId === 'string' && (isError === true || isNoPage)
    ? [callId]
    : [];
}

// The fetches and the failed ones of each host, from the host of each call id.
function countFetches(
  hosts: ReadonlyMap<string, string>,
  failedIds: ReadonlySet<string>,
): Record<string, HostFetches> {
  return [...hosts].reduce<Record<string, HostFetches>>((counts, [id, host]) => {
    const { fetches, failed } = counts[host] ?? NO_FETCHES;

    return {
      ...counts,
      [host]: { fetches: fetches + 1, failed: failed + (failedIds.has(id) ? 1 : 0) },
    };
  }, {});
}

function countNames(names: readonly string[]): Record<string, number> {
  return names.reduce<Record<string, number>>(
    (counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }),
    {},
  );
}
