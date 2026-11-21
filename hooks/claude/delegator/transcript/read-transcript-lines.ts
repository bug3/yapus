import { isRecord } from '../../../shared/is-record.ts';

// One line of a transcript file: a JSON object.
export type TranscriptLine = Readonly<Record<string, unknown>>;

// The lines of a transcript's text that parse to a JSON object, in order; a
// line that does not parse or holds another JSON value is left out.
export function readTranscriptLines(text: string): TranscriptLine[] {
  return text.split('\n').map(parseLine).filter((line) => line !== undefined);
}

function parseLine(text: string): TranscriptLine | undefined {
  try {
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
