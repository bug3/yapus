import { text } from 'node:stream/consumers';
import { getWithinLimit } from '../../shared/get-within-limit.ts';

// The whole of the stream as text, or undefined when it has not ended within
// the limit.
export async function readStdin(
  stdin: NodeJS.ReadableStream,
  limitSeconds: number,
): Promise<string | undefined> {
  return getWithinLimit(text(stdin), limitSeconds);
}
