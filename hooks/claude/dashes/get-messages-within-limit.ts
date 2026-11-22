import type { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import { getWithinLimit } from '../../shared/get-within-limit.ts';
import { getMessages } from './get-messages.ts';
import { formatMessage } from './output/format-message.ts';

// The limit covers reading stdin and judging what it holds. The exclusion
// question between them may run git synchronously, which holds the timer, so
// only runGit's own limit bounds that part.
export async function getMessagesWithinLimit(
  stdin: Readable,
  limitSeconds: number,
  isExcluded: () => boolean,
): Promise<string[]> {
  const messages = await getWithinLimit(getMessagesFromStdin(stdin, isExcluded), limitSeconds);

  return messages ?? [
    formatMessage(
      `no answer within ${ String(limitSeconds) } seconds; the call is blocked, retry it`,
    ),
  ];
}

// stdin is read whole before the question, also when the call then passes:
// a hook that exits with input unread breaks the harness's pipe.
async function getMessagesFromStdin(
  stdin: Readable,
  isExcluded: () => boolean,
): Promise<string[]> {
  const stdinText = await text(stdin);

  return isExcluded() ? [] : getMessages(stdinText);
}
