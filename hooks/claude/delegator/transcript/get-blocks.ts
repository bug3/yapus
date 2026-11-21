import { isRecord } from '../../../shared/is-record.ts';
import type { TranscriptLine } from './read-transcript-lines.ts';

// The JSON objects of the content list of a line's message, in order; none
// for a line whose message holds no such list.
export function getBlocks(line: TranscriptLine): TranscriptLine[] {
  const { message } = line;

  return isRecord(message) && Array.isArray(message.content)
    ? message.content.filter(isRecord)
    : [];
}
