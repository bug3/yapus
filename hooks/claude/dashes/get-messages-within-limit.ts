import type { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { getWithinLimit } from '../../shared/get-within-limit.ts';
import { getMessages } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers the whole run: reading stdin and judging what it holds.
export async function getMessagesWithinLimit(
  stdin: Readable,
  limitSeconds: number,
): Promise<string[]> {
  const messages = await getWithinLimit(getMessagesFromStdin(stdin), limitSeconds);

  return messages ?? [
    formatMessage(
      `no answer within ${ String(limitSeconds) } seconds; the call is blocked, retry it`,
    ),
  ];
}

async function getMessagesFromStdin(stdin: Readable): Promise<string[]> {
  return getMessages(await text(stdin));
}
