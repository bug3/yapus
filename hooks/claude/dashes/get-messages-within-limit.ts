import type { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { getMessages } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers the whole run: reading stdin and judging what it holds.
export async function getMessagesWithinLimit(
  stdin: Readable,
  limitSeconds: number,
): Promise<string[]> {
  let timer: NodeJS.Timeout | undefined;

  const limitReached = new Promise<string[]>((resolve) => {
    timer = setTimeout(() => {
      resolve([
        formatMessage(
          `no answer within ${ String(limitSeconds) } seconds; the call is blocked, retry it`,
        ),
      ]);
    }, limitSeconds * 1000);
  });

  try {
    return await Promise.race([getMessagesFromStdin(stdin), limitReached]);
  } finally {
    clearTimeout(timer);
  }
}

async function getMessagesFromStdin(stdin: Readable): Promise<string[]> {
  return getMessages(await text(stdin));
}
