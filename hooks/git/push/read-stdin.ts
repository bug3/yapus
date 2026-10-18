import { text } from 'node:stream/consumers';

// The whole of the stream as text, or undefined when it has not ended within
// the limit.
export async function readStdin(
  stdin: NodeJS.ReadableStream,
  limitMs: number,
): Promise<string | undefined> {
  let timer: NodeJS.Timeout | undefined;

  const limitReached = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined);
    }, limitMs);
  });

  try {
    return await Promise.race([text(stdin), limitReached]);
  } finally {
    clearTimeout(timer);
  }
}
